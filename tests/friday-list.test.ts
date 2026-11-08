import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { osloTime } from "@/game/time";

const url = process.env.TEST_DATABASE_URL;
if (url) {
  process.env.DATABASE_URL = url;
  process.env.QR_SECRET = "test";
}

describe.skipIf(!url)("fredagslista mot database", async () => {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const { eq } = await import("drizzle-orm");
  const { sql, db } = await import("@/db");
  const schema = await import("@/db/schema");
  const { defaultSettings } = await import("@/db/defaults");
  const weekly = await import("@/server/weekly");
  type Viewer = import("@/server/auth/session").Viewer;

  const week1 = "2026-11-02";
  const week2 = "2026-11-09";
  const startedAt = osloTime(week1, "09:00");
  const monday = osloTime(week2, "10:00");
  const fridayEvening = osloTime("2026-11-06", "17:00");
  const rules = { days: 1, hours: 2, windowStart: "08:00", windowEnd: "16:00", killsRequired: 1 };

  let season: typeof schema.seasons.$inferSelect;
  let viewer: Viewer;
  let ids: Record<"passes" | "fails" | "gone" | "exempt", string>;

  const notices = () => db.$count(schema.notifications);
  const list = (week = week1) => db.select().from(schema.weeklyReviews).where(eq(schema.weeklyReviews.weekStart, week));

  beforeAll(async () => {
    await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
    await sql`truncate table users, seasons, job_runs restart identity cascade`;
    const users = await db
      .insert(schema.users)
      .values(["gm", "passes", "fails", "gone", "exempt"].map((u) => ({ username: `fredag-${u}`, name: u, email: `${u}@example.test` })))
      .returning();
    const settings = { ...defaultSettings(), defaultRules: rules };
    [season] = await db.insert(schema.seasons).values({ name: "Fredagstest", phase: "running", startedAt, settings }).returning() as [typeof season];
    await db.insert(schema.staff).values({ seasonId: season.id, username: users[0]!.username });
    const players = await db
      .insert(schema.players)
      .values(users.slice(1).map((u) => ({
        seasonId: season.id,
        userId: u.id,
        name: u.name,
        consentAt: startedAt,
        status: u.name === "gone" ? ("eliminated" as const) : ("alive" as const),
        requirementsFromWeek: u.name === "exempt" ? week2 : null,
      })))
      .returning();
    ids = Object.fromEntries(players.map((p) => [p.name, p.id])) as typeof ids;
    await db.insert(schema.checkins).values([
      { seasonId: season.id, playerId: ids.passes, checkInAt: osloTime(week1, "09:00"), checkOutAt: osloTime(week1, "12:00") },
      { seasonId: season.id, playerId: ids.fails, checkInAt: osloTime(week1, "09:00"), checkOutAt: osloTime(week1, "12:00") },
    ]);
    const kill = { seasonId: season.id, victimId: ids.gone, reportedBy: "killer" as const, status: "applied" as const };
    await db.insert(schema.kills).values([
      { ...kill, killerId: ids.passes, killedAt: osloTime("2026-11-03", "12:00") },
      { ...kill, killerId: ids.fails, killedAt: osloTime(week2, "09:00") },
    ]);
    // Stricter rules from week two must not reach back to week one.
    await db.insert(schema.weekRules).values({ seasonId: season.id, weekStart: week2, rules: { ...rules, days: 5 } });
    viewer = {
      user: users[0]!,
      isKokLeader: false,
      isIndexLeader: false,
      isSuperadmin: false,
      season,
      player: null,
      isGamemaster: true,
      emergencyUntil: null,
      canSeeCircle: false,
      canManageRoles: false,
    };
  });

  beforeEach(async () => {
    await sql`truncate table weekly_reviews, notifications, job_runs`;
  });

  it("vurderer en tidligere uke med den ukas regler og drap, uten dem som er ute", async () => {
    const result = await weekly.buildFridayListManually(viewer, week1, monday);
    expect(result).toEqual({ claimed: true, existed: false, added: 1, pending: 1 });
    const [review, ...rest] = await list();
    expect(rest).toEqual([]);
    expect(review?.playerId).toBe(ids.fails);
    expect(review?.reasons).toEqual(["Mangler 1 drap (har 0 av 1)"]);
    expect(await notices()).toBe(1);
  });

  it("teller tidligere ukers drap mot det gjeldende drapskravet", async () => {
    await db.update(schema.weekRules).set({ rules: { ...rules, days: 0 } });
    try {
      const results = await weekly.evaluateSeasonWeek(season, week2, monday);
      expect(results.find((r) => r.player.id === ids.passes)?.evaluation).toMatchObject({ kills: 1, ok: true });
      expect(results.find((r) => r.player.id === ids.exempt)?.evaluation).toMatchObject({ kills: 0, ok: false });
    } finally {
      await db.update(schema.weekRules).set({ rules: { ...rules, days: 5 } });
    }
  });

  describe("drap i helga", () => {
    const saturday = async () => {
      const [kill] = await db
        .insert(schema.kills)
        .values({ seasonId: season.id, killerId: ids.fails, victimId: ids.gone, reportedBy: "killer", status: "applied", killedAt: osloTime("2026-11-07", "12:00") })
        .returning();
      return kill!;
    };

    it("teller på en liste som lages etter helga", async () => {
      const kill = await saturday();
      expect(await weekly.buildFridayListManually(viewer, week1, monday)).toMatchObject({ claimed: true, added: 0 });
      expect(await list()).toEqual([]);
      await db.delete(schema.kills).where(eq(schema.kills.id, kill.id));
    });

    it("fjerner ikke en sak som allerede står på lista", async () => {
      await weekly.buildFridayListOnce(season, week1, fridayEvening);
      const kill = await saturday();
      expect(await weekly.buildFridayListManually(viewer, week1, monday)).toEqual({ claimed: false, existed: true, added: 0, pending: 1 });
      const [review] = await list();
      expect(review?.playerId).toBe(ids.fails);
      expect(review?.reasons).toEqual(["Mangler 1 drap (har 0 av 1)"]);
      await db.delete(schema.kills).where(eq(schema.kills.id, kill.id));
    });
  });

  it("avviser uker utenfor spillet og ikke-spillmestere", async () => {
    await expect(weekly.buildFridayListManually(viewer, "2026-11-16", monday)).rejects.toThrow("ikke startet ennå");
    await expect(weekly.buildFridayListManually(viewer, "2026-10-26", monday)).rejects.toThrow("hadde ikke startet");
    await expect(weekly.buildFridayListManually(viewer, "tull", monday)).rejects.toThrow("Ugyldig uke");
    await expect(weekly.buildFridayListManually({ ...viewer, isGamemaster: false }, week1, monday)).rejects.toThrow();
    await expect(weekly.buildFridayListManually({ ...viewer, season: { ...season, phase: "ended" } }, week1, monday)).rejects.toThrow("mens spillet pågår");
    expect(await list()).toEqual([]);
  });

  it("en ny kjøring dupliserer ikke og rører ikke avgjorte saker", async () => {
    await weekly.buildFridayListManually(viewer, week1, monday);
    const [review] = await list();
    await db.update(schema.weeklyReviews).set({ decision: "exception", decisionReason: "Syk" }).where(eq(schema.weeklyReviews.id, review!.id));
    const again = await weekly.buildFridayListManually(viewer, week1, monday);
    expect(again).toEqual({ claimed: false, existed: true, added: 0, pending: 0 });
    const rows = await list();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.decision).toBe("exception");
    expect(rows[0]?.decisionReason).toBe("Syk");
    expect(await notices()).toBe(1);
  });

  it("cron lager ikke lista på nytt etter en manuell kjøring, og omvendt", async () => {
    await weekly.buildFridayListManually(viewer, week1, fridayEvening);
    expect(await weekly.buildFridayListOnce(season, week1, fridayEvening)).toBe(false);
    expect(await notices()).toBe(1);

    await sql`truncate table weekly_reviews, notifications, job_runs`;
    expect(await weekly.buildFridayListOnce(season, week1, fridayEvening)).toBe(true);
    expect((await weekly.buildFridayListManually(viewer, week1, monday)).existed).toBe(true);
    expect(await notices()).toBe(1);
  });

  it("samtidige kjøringer gir én liste og ett varsel", async () => {
    await Promise.all([
      weekly.buildFridayListManually(viewer, week1, monday),
      weekly.buildFridayListManually(viewer, week1, monday),
      weekly.buildFridayListOnce(season, week1, monday),
    ]);
    expect(await list()).toHaveLength(1);
    expect(await notices()).toBe(1);
  });

  it("en liste laget før fristen stopper ikke cron, og bare cron varsler", async () => {
    const wednesday = osloTime("2026-11-04", "12:00");
    expect(await weekly.buildFridayListManually(viewer, week1, wednesday)).toMatchObject({ claimed: false, existed: false });
    expect(await notices()).toBe(0);
    expect(await weekly.missingFridayLists(season.id, [week1])).toEqual([week1]);
    expect(await weekly.buildFridayListOnce(season, week1, fridayEvening)).toBe(true);
    expect(await weekly.missingFridayLists(season.id, [week1])).toEqual([]);
    expect(await notices()).toBe(1);
  });

  it("en uke der alle besto, mangler ikke liste", async () => {
    await db.update(schema.weekRules).set({ rules: { ...rules, days: 0, killsRequired: 0 } });
    await weekly.buildFridayListManually(viewer, week2, osloTime("2026-11-16", "10:00"));
    expect(await list(week2)).toEqual([]);
    expect(await weekly.missingFridayLists(season.id, [week2, week1])).toEqual([week1]);
    await db.update(schema.weekRules).set({ rules: { ...rules, days: 5 } });
  });
});
