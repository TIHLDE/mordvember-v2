import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const url = process.env.TEST_DATABASE_URL;
if (url) {
  process.env.DATABASE_URL = url;
  process.env.QR_SECRET = "test";
  process.env.PHOTON_EMAIL_API_KEY = "test";
}

describe.skipIf(!url)("e-postkøen ved nullstilling mot database", async () => {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const { sql, db } = await import("@/db");
  const schema = await import("@/db/schema");
  const { defaultSettings } = await import("@/db/defaults");
  const admin = await import("@/server/admin");
  const email = await import("@/server/email");
  type Viewer = import("@/server/auth/session").Viewer;

  let season: typeof schema.seasons.$inferSelect;
  let gm: Viewer;

  const subjects = async () => (await db.select().from(schema.emailOutbox)).map((m) => m.subject).sort();
  const mail = (subject: string, over: Partial<typeof schema.emailOutbox.$inferInsert> = {}) => ({
    to: `${subject}@example.test`,
    subject,
    content: [],
    ...over,
  });
  const reset = () => admin.resetGame(gm, `Nullstill ${season.name}`);

  beforeAll(async () => {
    await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
    await sql`truncate table users, seasons, email_outbox, audit_log, job_runs restart identity cascade`;
    const [user] = await db.insert(schema.users).values({ username: "epost-gm", name: "gm", email: "gm@example.test" }).returning();
    [season] = await db.insert(schema.seasons).values({ name: "Epost", phase: "ended", settings: defaultSettings() }).returning() as [typeof season];
    gm = {
      user: user!,
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
    await sql`truncate table email_outbox`;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sletter all usendt e-post, men ikke sendt", async () => {
    await db.insert(schema.emailOutbox).values([
      mail("ventende"),
      mail("feilet", { status: "failed", attempts: 5 }),
      mail("hentet", { claimedAt: new Date(), attempts: 1 }),
      mail("sendt", { status: "sent", sentAt: new Date() }),
    ]);
    await reset();
    expect(await subjects()).toEqual(["sendt"]);
  });

  it("stopper resten av en hentet bunke når nullstillingen kommer midt i utsendingen", async () => {
    await db.insert(schema.emailOutbox).values([mail("en"), mail("to"), mail("tre")]);
    const send = vi.fn(async () => {
      await reset();
      return new Response("{}");
    });
    vi.stubGlobal("fetch", send);
    expect(await email.deliverPendingEmails()).toBe(0);
    // The one already on its way can't be called back, and its row stays gone, so it isn't sent twice.
    expect(send).toHaveBeenCalledTimes(1);
    expect(await subjects()).toEqual([]);
  });

  it("en sending som feiler etter nullstillingen, får ikke raden tilbake", async () => {
    await db.insert(schema.emailOutbox).values(mail("en"));
    vi.stubGlobal("fetch", async () => {
      await reset();
      return new Response("nei", { status: 500 });
    });
    expect(await email.deliverPendingEmails()).toBe(1);
    expect(await subjects()).toEqual([]);
  });

  it("utsendingen sender fortsatt vanlig e-post", async () => {
    await db.insert(schema.emailOutbox).values(mail("en"));
    vi.stubGlobal("fetch", async () => new Response("{}"));
    expect(await email.deliverPendingEmails()).toBe(0);
    const [row] = await db.select().from(schema.emailOutbox);
    expect(row).toMatchObject({ status: "sent", attempts: 1 });
  });
});
