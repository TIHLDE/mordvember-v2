import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, isNotNull, sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLog,
  emailTemplates,
  emergencyAccess,
  kills,
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
import { audit } from "./audit";
import { AccessError, type Viewer } from "./auth/session";
import { DEFAULT_TEMPLATES, queueEmail, type TemplateKey } from "./email";
import { GameError } from "./game";
import { deleteImages } from "./images";
import { notify } from "./notify";
import { defaultSettings, type Phase, PHASES } from "./season";

function gm(viewer: Viewer) {
  if (!viewer.season || !viewer.isGamemaster) throw new AccessError("Bare spillmestere kan gjøre dette");
  return viewer.season;
}

export async function createSeason(viewer: Viewer, name: string) {
  const first = !viewer.season;
  if (!first && !viewer.isGamemaster) throw new AccessError("Bare spillmestere kan opprette sesonger");
  if (first && !(viewer.isKokLeader || viewer.isIndexLeader || viewer.isGamemaster)) {
    throw new AccessError("Bare KoK-leder eller Index-leder kan opprette den første sesongen");
  }
  if (!name.trim()) throw new GameError("Gi sesongen et navn");
  const [season] = await db.insert(seasons).values({ name: name.trim(), settings: defaultSettings() }).returning();
  if (!season) throw new GameError("Kunne ikke opprette sesongen");
  if (viewer.season) {
    const carry = await db.select().from(staff).where(eq(staff.seasonId, viewer.season.id));
    if (carry.length) {
      await db.insert(staff).values(carry.map((s) => ({ seasonId: season.id, username: s.username, role: s.role, addedBy: s.addedBy }))).onConflictDoNothing();
    }
  }
  if (viewer.isKokLeader) {
    await db.insert(staff).values({ seasonId: season.id, username: viewer.user.username, role: "gamemaster" }).onConflictDoNothing();
  }
  await audit(db, { seasonId: season.id, actorUserId: viewer.user.id, action: "sesong.opprettet", details: { name } });
}

const ALLOWED_MOVES: Record<Phase, Phase[]> = {
  setup: ["signup"],
  signup: ["setup", "closed"],
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
  const set: Partial<typeof seasons.$inferInsert> = { phase };
  if (phase === "ended") set.endedAt = new Date();
  if (phase === "signup" && season.signupDeadline && season.signupDeadline <= new Date()) {
    throw new GameError("Fristen er passert. Sett en ny frist først.");
  }
  await db.update(seasons).set(set).where(eq(seasons.id, season.id));
  await audit(db, { seasonId: season.id, actorUserId: viewer.user.id, action: "sesong.fase", details: { phase } });
}

export async function updateSeasonBasics(viewer: Viewer, input: { name: string; signupDeadline: Date | null; rulesText: string; dates: string }) {
  const season = gm(viewer);
  const settings: SeasonSettings = { ...season.settings, info: { rules: input.rulesText, dates: input.dates } };
  await db
    .update(seasons)
    .set({ name: input.name.trim() || season.name, signupDeadline: input.signupDeadline, settings })
    .where(eq(seasons.id, season.id));
  await audit(db, { seasonId: season.id, actorUserId: viewer.user.id, action: "sesong.endret" });
}

export async function updateSettings(viewer: Viewer, patch: Partial<SeasonSettings>) {
  const season = gm(viewer);
  const settings = { ...season.settings, ...patch };
  await db.update(seasons).set({ settings }).where(eq(seasons.id, season.id));
  await audit(db, { seasonId: season.id, actorUserId: viewer.user.id, action: "sesong.innstillinger", details: { felt: Object.keys(patch) } });
}

export async function setWeekRules(viewer: Viewer, weekStart: string, rules: WeekRules | null) {
  const season = gm(viewer);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) throw new GameError("Ugyldig uke");
  if (rules === null) {
    await db.delete(weekRules).where(and(eq(weekRules.seasonId, season.id), eq(weekRules.weekStart, weekStart)));
  } else {
    await db
      .insert(weekRules)
      .values({ seasonId: season.id, weekStart, rules })
      .onConflictDoUpdate({ target: [weekRules.seasonId, weekRules.weekStart], set: { rules } });
  }
  await audit(db, { seasonId: season.id, actorUserId: viewer.user.id, action: "uke.regler", details: { weekStart } });
}

const tokenHash = (t: string) => createHash("sha256").update(t).digest("hex");

export async function createScreenLink(viewer: Viewer): Promise<string> {
  const season = gm(viewer);
  const token = randomBytes(24).toString("base64url");
  await db.update(seasons).set({ screenTokenHash: tokenHash(token), screenTokenCreatedAt: new Date() }).where(eq(seasons.id, season.id));
  await audit(db, { seasonId: season.id, actorUserId: viewer.user.id, action: "tavle.ny_lenke" });
  return token;
}

export async function revokeScreenLink(viewer: Viewer) {
  const season = gm(viewer);
  await db.update(seasons).set({ screenTokenHash: null, screenTokenCreatedAt: null }).where(eq(seasons.id, season.id));
  await audit(db, { seasonId: season.id, actorUserId: viewer.user.id, action: "tavle.trukket_tilbake" });
}

export async function seasonForScreenToken(token: string) {
  if (!token || token.length < 20) return null;
  return (await db.query.seasons.findFirst({ where: eq(seasons.screenTokenHash, tokenHash(token)) })) ?? null;
}

export async function deleteSeasonData(viewer: Viewer, seasonId: string, confirmName: string) {
  if (!viewer.isGamemaster) throw new AccessError();
  const season = await db.query.seasons.findFirst({ where: eq(seasons.id, seasonId) });
  if (!season) throw new GameError("Sesongen finnes ikke");
  if (season.phase !== "ended") throw new GameError("Sesongen må være avsluttet før data slettes");
  if (confirmName.trim() !== season.name) throw new GameError("Skriv inn sesongnavnet nøyaktig for å bekrefte");
  const all = await db.select().from(players).where(eq(players.seasonId, seasonId));
  const killCount = await db.$count(kills, and(eq(kills.seasonId, seasonId), eq(kills.status, "applied")));
  const winner = all.find((p) => p.id === season.winnerPlayerId);
  const durationDays =
    season.startedAt && season.endedAt ? Math.max(1, Math.round((season.endedAt.getTime() - season.startedAt.getTime()) / 86400_000)) : 0;
  await deleteImages(all.map((p) => p.imageKey).filter((k): k is string => !!k));
  await db.transaction(async (tx) => {
    await tx.delete(players).where(eq(players.seasonId, seasonId));
    await tx.delete(questions).where(eq(questions.seasonId, seasonId));
    await tx.delete(notifications).where(eq(notifications.seasonId, seasonId));
    await tx.execute(dsql`delete from circles where season_id = ${seasonId}`);
    await tx.execute(dsql`delete from circle_events where season_id = ${seasonId}`);
    await tx
      .update(seasons)
      .set({
        dataDeletedAt: new Date(),
        summary: { participants: all.length, kills: killCount, durationDays },
        winnerName: winner?.winnerConsent ? winner.name : null,
        winnerPlayerId: null,
        screenTokenHash: null,
      })
      .where(eq(seasons.id, seasonId));
    await audit(tx, { seasonId, actorUserId: viewer.user.id, action: "sesong.data_slettet" });
  });
}

export async function addStaff(viewer: Viewer, username: string, role: "gamemaster" | "organizer") {
  if (!viewer.season || !viewer.canManageRoles) throw new AccessError();
  const clean = username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{2,64}$/.test(clean)) throw new GameError("Ugyldig brukernavn");
  if (role === "gamemaster") {
    const user = await db.query.users.findFirst({ where: eq(users.username, clean) });
    if (user) {
      const isPlayer = await db.query.players.findFirst({ where: and(eq(players.seasonId, viewer.season.id), eq(players.userId, user.id)) });
      if (isPlayer) throw new GameError("En deltaker kan ikke være spillmester i samme sesong");
    }
  }
  await db
    .insert(staff)
    .values({ seasonId: viewer.season.id, username: clean, role, addedBy: viewer.user.id })
    .onConflictDoUpdate({ target: [staff.seasonId, staff.username], set: { role } });
  await audit(db, { seasonId: viewer.season.id, actorUserId: viewer.user.id, action: "rolle.lagt_til", details: { username: clean, role } });
}

export async function removeStaff(viewer: Viewer, staffId: string) {
  if (!viewer.season || !viewer.canManageRoles) throw new AccessError();
  const [removed] = await db.delete(staff).where(and(eq(staff.id, staffId), eq(staff.seasonId, viewer.season.id))).returning();
  if (removed) {
    await audit(db, { seasonId: viewer.season.id, actorUserId: viewer.user.id, action: "rolle.fjernet", details: { username: removed.username, role: removed.role } });
  }
}

export async function listStaff(seasonId: string) {
  return db
    .select({ id: staff.id, username: staff.username, role: staff.role, name: users.name })
    .from(staff)
    .leftJoin(users, eq(users.username, staff.username))
    .where(eq(staff.seasonId, seasonId))
    .orderBy(staff.role, staff.username);
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
      .where(and(eq(staff.seasonId, viewer.season!.id), eq(staff.role, "gamemaster")));
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

export async function seasonsNeedingDeletion() {
  return db
    .select()
    .from(seasons)
    .where(and(eq(seasons.phase, "ended"), isNotNull(seasons.endedAt), dsql`${seasons.dataDeletedAt} is null`));
}

export async function usersWithoutPlayer(seasonId: string) {
  const inSeason = db.select({ id: players.userId }).from(players).where(eq(players.seasonId, seasonId));
  return db
    .select({ id: users.id, name: users.name, username: users.username })
    .from(users)
    .where(dsql`${users.id} not in (${inSeason})`)
    .orderBy(users.name);
}

