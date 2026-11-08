import { beforeAll, describe, expect, it } from "vite-plus/test";
import { eq } from "drizzle-orm";

const url = process.env.TEST_DATABASE_URL;
if (url) {
  process.env.DATABASE_URL = url;
  process.env.QR_SECRET = "test";
}

describe.skipIf(!url)("tilgang mot database", async () => {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const { sql, db } = await import("@/db");
  const schema = await import("@/db/schema");
  const { defaultSettings } = await import("@/db/defaults");
  const { CONFIRM_TIMEOUT_MS } = await import("@/game/kills");
  const admin = await import("@/server/admin");
  const { AccessError } = await import("@/server/auth/session");
  const circle = await import("@/server/circle");
  const { runCron } = await import("@/server/cron");
  const game = await import("@/server/game");
  const players = await import("@/server/players");
  type Viewer = import("@/server/auth/session").Viewer;

  let season: typeof schema.seasons.$inferSelect;
  const viewers: Record<string, Viewer> = {};
  let ids: string[] = [];

  function viewer(user: typeof schema.users.$inferSelect, over: Partial<Viewer>): Viewer {
    return {
      user,
      isKokLeader: false,
      isIndexLeader: false,
      isSuperadmin: false,
      season,
      player: null,
      isGamemaster: false,
      emergencyUntil: null,
      canSeeCircle: false,
      canManageRoles: false,
      ...over,
    };
  }

  beforeAll(async () => {
    await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
    await sql`truncate table users, seasons, email_outbox, audit_log restart identity cascade`;
    const users = await db
      .insert(schema.users)
      .values(
        Array.from({ length: 8 }, (_, i) => ({
          username: `test-u${i}`,
          name: `Testperson ${i}`,
          email: `u${i}@example.test`,
        })),
      )
      .returning();
    [season] = (await db
      .insert(schema.seasons)
      .values({ name: "Tilgangstest", phase: "closed", settings: defaultSettings() })
      .returning()) as [typeof season];
    const players = await db
      .insert(schema.players)
      .values(
        users
          .slice(0, 5)
          .map((u) => ({ seasonId: season.id, userId: u.id, name: u.name, consentAt: new Date() })),
      )
      .returning();
    ids = players.map((p) => p.id);
    const gmUser = users[5]!;
    viewers.gm = viewer(gmUser, { isGamemaster: true, canSeeCircle: true, canManageRoles: true });
    viewers.member = viewer(users[7]!, {});
    viewers.participant = viewer(users[0]!, { player: players[0]! });
    viewers.indexNoEmergency = viewer(users[1]!, {
      player: players[1]!,
      isIndexLeader: true,
      canManageRoles: true,
    });
    viewers.indexEmergency = viewer(users[1]!, {
      player: players[1]!,
      isIndexLeader: true,
      canManageRoles: true,
      emergencyUntil: new Date(Date.now() + 3600_000),
      canSeeCircle: true,
    });
    await game.generateCircle(viewers.gm);
    await game.startGame({ ...viewers.gm, season: { ...season, phase: "closed" } });
    season = (await db.query.seasons.findFirst())!;
    for (const v of Object.values(viewers)) v.season = season;
  });

  it("bare spillmester og Index-leder med nødtilgang ser sirkelen", async () => {
    for (const role of ["member", "participant", "indexNoEmergency"]) {
      await expect(circle.circleForAdmin(viewers[role]!, "test"), role).rejects.toBeInstanceOf(
        AccessError,
      );
      await expect(circle.circleEventsForAdmin(viewers[role]!), role).rejects.toBeInstanceOf(
        AccessError,
      );
    }
    expect(await circle.circleForAdmin(viewers.gm!, "test")).toHaveLength(5);
    expect(await circle.circleForAdmin(viewers.indexEmergency!, "test")).toHaveLength(5);
    const logged = await db.select().from(schema.auditLog);
    expect(logged.filter((l) => l.action === "sirkel.vist")).toHaveLength(2);
  });

  it("en deltaker får bare sitt eget offer, med id, navn og bio", async () => {
    const full = await circle.circleForAdmin(viewers.gm!, "test");
    const mine = full.find((c) => c.id === ids[0])!;
    const target = await circle.myTarget(viewers.participant!);
    expect(target).toEqual({ id: mine.targetId, name: expect.any(String), bio: null });
    expect(Object.keys(target!).sort()).toEqual(["bio", "id", "name"]);
    expect(await circle.myTarget(viewers.member!)).toBeNull();
  });

  it("deltakere, medlemmer og Index-leder kan ikke endre sirkelen", async () => {
    for (const role of ["participant", "member", "indexEmergency"]) {
      const v = viewers[role]!;
      await expect(game.moveInCircle(v, ids[0]!, ids[2]!), role).rejects.toBeInstanceOf(
        AccessError,
      );
      await expect(game.grantMercy(v, ids[0]!, null), role).rejects.toBeInstanceOf(AccessError);
      await expect(game.generateCircle(v), role).rejects.toBeInstanceOf(AccessError);
      await expect(game.undoKillAsGamemaster(v, ids[0]!), role).rejects.toBeInstanceOf(AccessError);
    }
  });

  it("deltakere og medlemmer kan ikke godkjenne, avvise eller diskvalifisere", async () => {
    for (const role of ["participant", "member", "indexNoEmergency"]) {
      const v = viewers[role]!;
      await expect(game.approveKill(v, ids[0]!, ""), role).rejects.toBeInstanceOf(AccessError);
      await expect(game.rejectKill(v, ids[0]!, ""), role).rejects.toBeInstanceOf(AccessError);
      await expect(game.disqualify(v, [ids[2]!], "x"), role).rejects.toBeInstanceOf(AccessError);
    }
  });

  it("bare spillmester kan endre en annen deltakers utseende og bilde", async () => {
    const png = new File(["x"], "bilde.png", { type: "image/png" });
    for (const v of [viewers.participant!, viewers.member!]) {
      await expect(players.setBioAsGamemaster(v, ids[1]!, "Høyde: 1 cm")).rejects.toBeInstanceOf(
        AccessError,
      );
      await expect(players.setImageAsGamemaster(v, ids[1]!, png)).rejects.toBeInstanceOf(
        AccessError,
      );
    }
    await players.setBioAsGamemaster(viewers.gm!, ids[1]!, "Høyde: 180 cm");
    const [row] = await db.select().from(schema.players).where(eq(schema.players.id, ids[1]!));
    expect(row?.bio).toBe("Høyde: 180 cm");
    await expect(
      players.setBioAsGamemaster(viewers.gm!, "00000000-0000-0000-0000-000000000000", null),
    ).rejects.toThrow("finnes ikke");
  });

  it("feilmeldinger ved drapsmelding avslører ikke jegeren", async () => {
    await game.reportKill(viewers.participant!, "victim", new Date());
    const error = await game
      .reportKill(viewers.participant!, "victim", new Date())
      .catch((e: Error) => e);
    expect(error).toBeInstanceOf(game.GameError);
    for (const p of await db.select().from(schema.players))
      expect((error as Error).message).not.toContain(p.name);
    const notes = await db.select().from(schema.notifications);
    for (const n of notes)
      for (const p of await db.select().from(schema.players)) expect(n.text).not.toContain(p.name);
    const mails = await db.select().from(schema.emailOutbox);
    for (const m of mails)
      for (const p of await db.select().from(schema.players))
        expect(JSON.stringify(m.content) + m.subject).not.toContain(p.name);
  });

  it("et drap kan ikke bekreftes mens spillet er stoppet, men saken går ikke tapt", async () => {
    // Bruker saken som ble meldt i testen over. Offeret meldte, så morderen skal bekrefte.
    const kill = (await db.query.kills.findFirst())!;
    const killer = (await db.query.players.findFirst({
      where: (p, { eq }) => eq(p.id, kill.killerId),
    }))!;
    const user = (await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, killer.userId),
    }))!;
    const confirmer = viewer(user, { player: killer });
    const statusOf = async () =>
      (await db.query.kills.findFirst({ where: (k, { eq }) => eq(k.id, kill.id) }))!.status;
    const victim = () =>
      db.query.players.findFirst({ where: (p, { eq }) => eq(p.id, kill.victimId) });
    const ring = await circle.circleForAdmin(viewers.gm!, "test");

    await admin.setPhase(viewers.gm!, "ended");
    await expect(game.confirmKill(confirmer, kill.id)).rejects.toThrow(
      new game.GameError("Spillet er ikke i gang"),
    );
    expect(await statusOf()).toBe("pending");
    expect((await victim())!.status).toBe("alive");
    expect(await circle.circleForAdmin(viewers.gm!, "test")).toEqual(ring);

    await runCron(new Date(Date.now() + CONFIRM_TIMEOUT_MS + 60_000));
    expect(await statusOf()).toBe("escalated");
    await expect(game.approveKill(viewers.gm!, kill.id, "")).rejects.toThrow(
      new game.GameError("Spillet er ikke i gang"),
    );

    await game.resumeGame(viewers.gm!);
    await game.approveKill(viewers.gm!, kill.id, "");
    expect(await statusOf()).toBe("applied");
    expect((await victim())!.status).toBe("eliminated");
  });
});
