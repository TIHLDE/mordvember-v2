import { beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";
import { osloTime } from "@/game/time";

const url = process.env.TEST_DATABASE_URL;
if (url) {
  process.env.DATABASE_URL = url;
  process.env.QR_SECRET = "test";
  // One connection, as on Vercel: anything inside a transaction that reaches for `db` hangs and fails the test.
  process.env.VERCEL = "1";
}

describe.skipIf(!url)("glemte utsjekker mot database", async () => {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const { eq } = await import("drizzle-orm");
  const { sql, db } = await import("@/db");
  const schema = await import("@/db/schema");
  const { defaultSettings } = await import("@/db/defaults");
  const attendance = await import("@/server/attendance");
  type Viewer = import("@/server/auth/session").Viewer;

  const week1 = "2026-11-02";
  const week2 = "2026-11-09";
  const rules = { days: 1, hours: 2, windowStart: "08:00", windowEnd: "16:00", killsRequired: 0 };
  const office = { lat: 63.416162, lng: 10.405852, radiusMeters: 150 };
  const tuesday = osloTime("2026-11-03", "09:00");
  const wednesdayMorning = osloTime("2026-11-04", "08:30");

  let season: typeof schema.seasons.$inferSelect;
  let player: typeof schema.players.$inferSelect;
  let viewer: Viewer;
  let gm: Viewer;

  const rows = () => db.select().from(schema.checkins).orderBy(schema.checkins.checkInAt);
  const open = async (checkInAt: Date) => {
    const [row] = await db
      .insert(schema.checkins)
      .values({ seasonId: season.id, playerId: player.id, checkInAt })
      .returning();
    return row!;
  };

  beforeAll(async () => {
    await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
    await sql`truncate table users, seasons, job_runs restart identity cascade`;
    const users = await db
      .insert(schema.users)
      .values(
        ["gm", "spiller"].map((u) => ({
          username: `oppmote-${u}`,
          name: u,
          email: `${u}@example.test`,
        })),
      )
      .returning();
    const settings = { ...defaultSettings(), defaultRules: rules };
    [season] = (await db
      .insert(schema.seasons)
      .values({
        name: "Oppmøtetest",
        phase: "running",
        startedAt: osloTime(week1, "09:00"),
        settings,
      })
      .returning()) as [typeof season];
    [player] = (await db
      .insert(schema.players)
      .values({ seasonId: season.id, userId: users[1]!.id, name: "spiller", consentAt: new Date() })
      .returning()) as [typeof player];
    const base = {
      isKokLeader: false,
      isIndexLeader: false,
      isSuperadmin: false,
      season,
      emergencyUntil: null,
      canSeeCircle: false,
      canManageRoles: false,
    };
    viewer = { ...base, user: users[1]!, player, isGamemaster: false };
    gm = { ...base, user: users[0]!, player: null, isGamemaster: true };
  });

  beforeEach(async () => {
    await sql`truncate table checkins, week_rules`;
  });

  it("utsjekk lukker en økt fra en tidligere dag slik cron gjør, uten å gi en oppmøtedag", async () => {
    await open(tuesday);
    const result = await attendance.toggleCheckin(viewer, null, "out", wednesdayMorning);
    expect(result.kind).toBe("forgotten");
    const [row, ...rest] = await rows();
    expect(rest).toEqual([]);
    expect(row?.checkOutAt).toEqual(osloTime("2026-11-03", "16:00"));
    expect(row?.autoClosed).toBe(true);
    const status = await attendance.myAttendance(viewer, wednesdayMorning);
    expect(status?.counted).toBe(0);
    expect(status?.stale).toBeNull();
    expect(status?.days[1]).toMatchObject({ counts: false, hasUnclosed: true });
  });

  it("spillmesterne kan godkjenne økta etterpå", async () => {
    const row = await open(tuesday);
    await attendance.toggleCheckin(viewer, null, "out", wednesdayMorning);
    await attendance.editCheckin(gm, row.id, { kind: "approve" });
    expect((await attendance.myAttendance(viewer, wednesdayMorning))?.counted).toBe(1);
  });

  it("gir samme resultat som cron", async () => {
    await open(tuesday);
    await attendance.closeForgottenSessions(wednesdayMorning);
    const [byCron] = await rows();
    await sql`truncate table checkins`;
    await open(tuesday);
    await attendance.toggleCheckin(viewer, null, "out", wednesdayMorning);
    const [byPlayer] = await rows();
    expect(byPlayer).toMatchObject({
      checkOutAt: byCron?.checkOutAt,
      autoClosed: true,
      approved: false,
    });
  });

  it("innsjekk lukker den gamle økta og starter en ny", async () => {
    await open(tuesday);
    const result = await attendance.toggleCheckin(viewer, office, "in", wednesdayMorning);
    expect(result.kind).toBe("in");
    const [old, fresh, ...rest] = await rows();
    expect(rest).toEqual([]);
    expect(old).toMatchObject({ autoClosed: true, checkOutAt: osloTime("2026-11-03", "16:00") });
    expect(fresh).toMatchObject({
      autoClosed: false,
      checkOutAt: null,
      checkInAt: wednesdayMorning,
    });
    expect((await attendance.myAttendance(viewer, wednesdayMorning))?.open?.id).toBe(fresh?.id);
  });

  it("en innsjekk som avvises, lar den gamle økta stå urørt", async () => {
    await open(tuesday);
    await expect(
      attendance.toggleCheckin(viewer, { lat: 0, lng: 0 }, "in", wednesdayMorning),
    ).rejects.toThrow("Du må være på Gløshaugen");
    const [row] = await rows();
    expect(row).toMatchObject({ autoClosed: false, checkOutAt: null });
  });

  it("en økt som står åpen over helga, vises og lukkes med reglene fra sin egen uke", async () => {
    const friday = osloTime("2026-11-06", "09:00");
    await open(friday);
    await db
      .insert(schema.weekRules)
      .values({ seasonId: season.id, weekStart: week2, rules: { ...rules, windowEnd: "12:00" } });
    const monday = osloTime(week2, "08:30");
    const status = await attendance.myAttendance(viewer, monday);
    expect(status?.stale?.checkInAt).toEqual(friday);
    expect(status?.open).toBeNull();
    expect(status?.todays).toEqual([]);
    await attendance.toggleCheckin(viewer, null, "out", monday);
    const [row] = await rows();
    expect(row?.checkOutAt).toEqual(osloTime("2026-11-06", "16:00"));
  });

  it("en økt startet etter vinduet lukkes på innsjekkstiden", async () => {
    const evening = osloTime("2026-11-03", "20:00");
    await open(evening);
    await attendance.toggleCheckin(viewer, null, "out", wednesdayMorning);
    const [row] = await rows();
    expect(row?.checkOutAt).toEqual(evening);
  });

  it("en spiller regnes som sjekket inn bare i en åpen økt fra samme dag", async () => {
    expect(await attendance.isCheckedIn(player.id, tuesday)).toBe(false);
    await open(tuesday);
    const noon = osloTime("2026-11-03", "12:00");
    expect(await attendance.isCheckedIn(player.id, noon)).toBe(true);
    expect(await attendance.isCheckedIn(player.id, wednesdayMorning)).toBe(false);
    await attendance.toggleCheckin(viewer, null, "out", noon);
    expect(await attendance.isCheckedIn(player.id, noon)).toBe(false);
  });

  it("en økt som starter senere, regnes ikke som innsjekket ennå", async () => {
    await open(tuesday);
    const earlier = osloTime("2026-11-03", "08:00");
    expect(await attendance.isCheckedIn(player.id, earlier)).toBe(false);
    expect(await attendance.checkedInPlayers(season.id, earlier)).toEqual(new Set());
  });

  it("spillmesternes oversikt følger samme regel som offersiden", async () => {
    const noon = osloTime("2026-11-03", "12:00");
    expect(await attendance.checkedInPlayers(season.id, noon)).toEqual(new Set());
    await open(tuesday);
    expect(await attendance.checkedInPlayers(season.id, noon)).toEqual(new Set([player.id]));
    expect(await attendance.checkedInPlayers(season.id, wednesdayMorning)).toEqual(new Set());
  });

  it("en økt lukket av cron regnes ikke som innsjekket", async () => {
    await open(tuesday);
    await attendance.closeForgottenSessions(osloTime("2026-11-03", "16:00"));
    expect(await attendance.isCheckedIn(player.id, osloTime("2026-11-03", "16:00"))).toBe(false);
  });

  it("en utsjekk som kom først, overskrives ikke av cron", async () => {
    const row = await open(tuesday);
    const out = osloTime("2026-11-03", "12:00");
    await db.update(schema.checkins).set({ checkOutAt: out }).where(eq(schema.checkins.id, row.id));
    await attendance.closeForgottenSessions(wednesdayMorning);
    const [after] = await rows();
    expect(after).toMatchObject({ checkOutAt: out, autoClosed: false });
  });

  it("vanlig utsjekk samme dag og utsjekk uten åpen økt er som før", async () => {
    await open(tuesday);
    const noon = osloTime("2026-11-03", "12:00");
    expect((await attendance.myAttendance(viewer, noon))?.stale).toBeNull();
    expect((await attendance.toggleCheckin(viewer, null, "out", noon)).kind).toBe("out");
    const [row] = await rows();
    expect(row).toMatchObject({ checkOutAt: noon, autoClosed: false });
    await expect(attendance.toggleCheckin(viewer, null, "out", noon)).rejects.toThrow(
      "Du er ikke sjekket inn",
    );
  });
});
