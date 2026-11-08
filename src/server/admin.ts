import "@tanstack/react-start/server-only";
import { and, desc, eq, gt, inArray, isNotNull, like, ne, notExists, sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLog,
  emailOutbox,
  emailTemplates,
  emergencyAccess,
  jobRuns,
  notifications,
  players,
  questions,
  type SeasonSettings,
  seasons,
  staff,
  users,
  weekRules,
} from "@/db/schema";
import type { WeekRules } from "@/game/attendance";
import { weekStartOf } from "@/game/time";
import { audit } from "./audit";
import { AccessError, type Viewer } from "./auth/session";
import { DEFAULT_TEMPLATES, queueEmail, type TemplateKey } from "./email";
import { GameError } from "./game";
import { deleteImages } from "./images";
import { notify } from "./notify";
import { defaultSettings, type Phase, PHASES, rulesForWeek } from "./season";

function gm(viewer: Viewer) {
  if (!viewer.season || !viewer.isGamemaster) throw new AccessError("Bare spillmestere kan gjøre dette");
  return viewer.season;
}

// Only for a fresh install. After that there is one game, which is reset instead of replaced.
export async function createSeason(viewer: Viewer, name: string) {
  if (viewer.season) throw new GameError("Spillet finnes allerede");
  if (!(viewer.isKokLeader || viewer.isIndexLeader || viewer.isGamemaster)) {
    throw new AccessError("Bare KoK-leder eller Index-leder kan opprette spillet");
  }
  if (!name.trim()) throw new GameError("Gi spillet et navn");
  const [season] = await db.insert(seasons).values({ name: name.trim(), settings: defaultSettings() }).returning();
  if (!season) throw new GameError("Kunne ikke opprette spillet");
  if (viewer.isKokLeader || viewer.isSuperadmin) {
    await db.insert(staff).values({ seasonId: season.id, username: viewer.user.username }).onConflictDoNothing();
  }
  await audit(db, { seasonId: season.id, actorUserId: viewer.user.id, action: "spill.opprettet", details: { name } });
}

const ALLOWED_MOVES: Record<Phase, Phase[]> = {
  setup: ["signup"],
  signup: ["closed"],
  closed: ["signup"],
  running: ["ended"],
  ended: [],
};

export async function setPhase(viewer: Viewer, phase: Phase) {
  const season = gm(viewer);
  if (phase === "running") throw new GameError("Bruk «Start spillet» for å starte");
  if (!ALLOWED_MOVES[season.phase].includes(phase)) {
    throw new GameError(`Kan ikke gå fra ${PHASES.find((p) => p.key === season.phase)?.label} til ${PHASES.find((p) => p.key === phase)?.label}`);
  }
  await db.update(seasons).set({ phase }).where(eq(seasons.id, season.id));
  await audit(db, { seasonId: season.id, actorUserId: viewer.user.id, action: "sesong.fase", details: { phase } });
}

export async function updateSeasonBasics(
  viewer: Viewer,
  input: { name: string; rulesText: string },
) {
  const season = gm(viewer);
  const settings: SeasonSettings = { ...season.settings, info: { rules: input.rulesText } };
  await db
    .update(seasons)
    .set({ name: input.name.trim() || season.name, settings })
    .where(eq(seasons.id, season.id));
  await audit(db, { seasonId: season.id, actorUserId: viewer.user.id, action: "sesong.endret" });
}

export async function updateSettings(viewer: Viewer, patch: Partial<SeasonSettings>) {
  const season = gm(viewer);
  const settings = { ...season.settings, ...patch };
  await db.update(seasons).set({ settings }).where(eq(seasons.id, season.id));
  await audit(db, { seasonId: season.id, actorUserId: viewer.user.id, action: "sesong.innstillinger", details: { felt: Object.keys(patch) } });
}

export async function setRules(viewer: Viewer, rules: WeekRules) {
  const season = gm(viewer);
  const weekStart = weekStartOf(new Date());
  if (season.phase === "running" || season.phase === "ended") {
    await db
      .insert(weekRules)
      .values({ seasonId: season.id, weekStart, rules })
      .onConflictDoUpdate({ target: [weekRules.seasonId, weekRules.weekStart], set: { rules } });
    // Rows for later weeks would override this change when their week comes.
    await db.delete(weekRules).where(and(eq(weekRules.seasonId, season.id), gt(weekRules.weekStart, weekStart)));
  } else {
    await db.transaction(async (tx) => {
      await tx.update(seasons).set({ settings: { ...season.settings, defaultRules: rules } }).where(eq(seasons.id, season.id));
      await tx.delete(weekRules).where(eq(weekRules.seasonId, season.id));
    });
  }
  await audit(db, { seasonId: season.id, actorUserId: viewer.user.id, action: "regler.endret", details: { fra: weekStart } });
}

export async function resetGame(viewer: Viewer, confirm: string) {
  const season = gm(viewer);
  if (season.phase === "running") throw new GameError("Stopp spillet før du nullstiller");
  if (confirm !== `Nullstill ${season.name}`) throw new GameError(`Skriv «Nullstill ${season.name}» for å bekrefte`);
  const rules = await rulesForWeek(season, weekStartOf(new Date()));
  const { all, photonCopies } = await db.transaction(async (tx) => {
    // Locked and checked again, so a game started in the meantime is not wiped.
    const [locked] = await tx.select({ phase: seasons.phase }).from(seasons).where(eq(seasons.id, season.id)).for("update");
    if (locked?.phase === "running") throw new GameError("Stopp spillet før du nullstiller");
    const all = await tx.select({ imageKey: players.imageKey }).from(players).where(eq(players.seasonId, season.id));
    await tx.delete(players).where(eq(players.seasonId, season.id));
    const unused = await tx
      .select({ id: users.id, key: users.photonImageKey })
      .from(users)
      .where(and(isNotNull(users.photonImageKey), notExists(tx.select().from(players).where(eq(players.userId, users.id)))));
    if (unused.length) await tx.update(users).set({ photonImageKey: null }).where(inArray(users.id, unused.map((u) => u.id)));
    await tx.delete(questions).where(eq(questions.seasonId, season.id));
    await tx.delete(notifications).where(eq(notifications.seasonId, season.id));
    await tx.delete(auditLog).where(eq(auditLog.seasonId, season.id));
    await tx.execute(dsql`delete from circles where season_id = ${season.id}`);
    await tx.execute(dsql`delete from circle_events where season_id = ${season.id}`);
    await tx.delete(weekRules).where(eq(weekRules.seasonId, season.id));
    // Weekly job claims are keyed by season and week, and would stop a new game's jobs from running.
    await tx.delete(jobRuns).where(like(jobRuns.key, `%:${season.id}:%`));
    // There is one game, so everything unsent belongs to it. Claimed e-mails go too: a claim that is left would be picked up again after five minutes if its sender died.
    await tx.delete(emailOutbox).where(ne(emailOutbox.status, "sent"));
    await tx
      .update(seasons)
      .set({ settings: { ...season.settings, defaultRules: rules }, phase: "setup", startedAt: null, winnerPlayerId: null })
      .where(eq(seasons.id, season.id));
    await audit(tx, { seasonId: season.id, actorUserId: viewer.user.id, action: "spill.nullstilt", details: { deltakere: all.length } });
    return { all, photonCopies: unused.map((u) => u.key) };
  });
  await deleteImages([...all.map((p) => p.imageKey), ...photonCopies].filter((k): k is string => !!k));
}

export async function addStaff(viewer: Viewer, username: string) {
  if (!viewer.season || !viewer.canManageRoles) throw new AccessError();
  const clean = username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{2,64}$/.test(clean)) throw new GameError("Ugyldig brukernavn");
  const user = await db.query.users.findFirst({ where: eq(users.username, clean) });
  if (user) {
    const isPlayer = await db.query.players.findFirst({ where: and(eq(players.seasonId, viewer.season.id), eq(players.userId, user.id)) });
    if (isPlayer) throw new GameError("En deltaker kan ikke være spillmester");
  }
  await db.insert(staff).values({ seasonId: viewer.season.id, username: clean, addedBy: viewer.user.id }).onConflictDoNothing();
  await audit(db, { seasonId: viewer.season.id, actorUserId: viewer.user.id, action: "rolle.lagt_til", details: { username: clean } });
}

export async function removeStaff(viewer: Viewer, staffId: string) {
  if (!viewer.season || !viewer.canManageRoles) throw new AccessError();
  const [removed] = await db.delete(staff).where(and(eq(staff.id, staffId), eq(staff.seasonId, viewer.season.id))).returning();
  if (removed) {
    await audit(db, { seasonId: viewer.season.id, actorUserId: viewer.user.id, action: "rolle.fjernet", details: { username: removed.username } });
  }
}

export async function listStaff(seasonId: string) {
  return db
    .select({ id: staff.id, username: staff.username, name: users.name })
    .from(staff)
    .leftJoin(users, eq(users.username, staff.username))
    .where(eq(staff.seasonId, seasonId))
    .orderBy(staff.username);
}

export async function startEmergencyAccess(viewer: Viewer, reason: string) {
  if (!viewer.isIndexLeader || !viewer.season) throw new AccessError("Bare Index-leder har nødtilgang");
  if (reason.trim().length < 10) throw new GameError("Skriv en begrunnelse på minst ti tegn");
  await db.transaction(async (tx) => {
    await tx.insert(emergencyAccess).values({ userId: viewer.user.id, reason: reason.trim(), expiresAt: new Date(Date.now() + 3600_000) });
    await audit(tx, { seasonId: viewer.season!.id, actorUserId: viewer.user.id, action: "nodtilgang.startet", details: { reason: reason.trim() } });
    const gmRows = await tx
      .select({ userId: users.id, email: users.email })
      .from(staff)
      .innerJoin(users, eq(users.username, staff.username))
      .where(eq(staff.seasonId, viewer.season!.id));
    await notify(tx, gmRows.map((g) => ({ userId: g.userId, seasonId: viewer.season!.id, text: `Index-leder har slått på nødtilgang: ${reason.trim()}`, href: "/admin/logg" })));
    await queueEmail(tx, "emergency_access", gmRows.map((g) => g.email), {
      navn: viewer.user.name,
      grunn: reason.trim(),
    });
  });
}

export async function endEmergencyAccess(viewer: Viewer) {
  if (!viewer.isIndexLeader) throw new AccessError();
  await db
    .update(emergencyAccess)
    .set({ endedAt: new Date() })
    .where(and(eq(emergencyAccess.userId, viewer.user.id), dsql`${emergencyAccess.endedAt} is null`));
  await audit(db, { seasonId: viewer.season?.id ?? null, actorUserId: viewer.user.id, action: "nodtilgang.avsluttet" });
}

export async function auditEntries(seasonId: string) {
  return db
    .select({ id: auditLog.id, action: auditLog.action, details: auditLog.details, createdAt: auditLog.createdAt, actor: users.name })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorUserId))
    .where(eq(auditLog.seasonId, seasonId))
    .orderBy(desc(auditLog.createdAt))
    .limit(300);
}

export async function saveTemplate(viewer: Viewer, key: TemplateKey, subject: string, body: string) {
  gm(viewer);
  if (!(key in DEFAULT_TEMPLATES)) throw new GameError("Ukjent mal");
  if (!subject.trim() || !body.trim()) throw new GameError("Emne og tekst kan ikke være tomme");
  await db
    .insert(emailTemplates)
    .values({ key, subject, body, updatedBy: viewer.user.id })
    .onConflictDoUpdate({ target: emailTemplates.key, set: { subject, body, updatedBy: viewer.user.id, updatedAt: new Date() } });
}

export async function resetTemplate(viewer: Viewer, key: TemplateKey) {
  gm(viewer);
  await db.delete(emailTemplates).where(eq(emailTemplates.key, key));
}

export async function templates() {
  const overrides = await db.select().from(emailTemplates);
  return (Object.keys(DEFAULT_TEMPLATES) as TemplateKey[]).map((key) => {
    const o = overrides.find((t) => t.key === key);
    const d = DEFAULT_TEMPLATES[key];
    return { key, label: d.label, subject: o?.subject ?? d.subject, body: o?.body ?? d.body, custom: !!o };
  });
}

export async function usersWithoutPlayer(seasonId: string) {
  const inSeason = db.select({ id: players.userId }).from(players).where(eq(players.seasonId, seasonId));
  return db
    .select({ id: users.id, name: users.name, username: users.username })
    .from(users)
    .where(dsql`${users.id} not in (${inSeason})`)
    .orderBy(users.name);
}

