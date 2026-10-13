import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, asc, desc, eq, gte, isNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { checkins, players } from "@/db/schema";
import { type AttendanceSession, closeTimeFor, dayResults, distanceMeters } from "@/game/attendance";
import { qrCode, verifyQrCode } from "@/game/qr";
import { addDays, osloDate, osloTime, weekStartOf } from "@/game/time";
import { audit } from "./audit";
import { AccessError, type Viewer } from "./auth/session";
import { env } from "./env";
import { GameError } from "./game";
import { rulesForWeek } from "./season";

export const PENDING_SCAN_COOKIE = "mv_scan";
export const PENDING_SCAN_MS = 10 * 60 * 1000;

export function boardQr(seasonId: string, now = Date.now()) {
  const code = qrCode(env.qrSecret, seasonId, now);
  return { code, url: `${env.appUrl}/api/sjekkinn?k=${encodeURIComponent(code)}` };
}

export function verifyScan(seasonId: string, code: string, now = Date.now()) {
  return verifyQrCode(env.qrSecret, seasonId, code, now);
}

function sign(value: string) {
  return createHmac("sha256", env.qrSecret).update(`scan:${value}`).digest("base64url");
}

export function pendingScanValue(seasonId: string, now = Date.now()) {
  const value = `${seasonId}.${now + PENDING_SCAN_MS}`;
  return `${value}.${sign(value)}`;
}

export function readPendingScan(cookie: string | undefined, seasonId: string, now = Date.now()): boolean {
  if (!cookie) return false;
  const parts = cookie.split(".");
  if (parts.length !== 3) return false;
  const [sid, expires, sig] = parts as [string, string, string];
  const expected = Buffer.from(sign(`${sid}.${expires}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  return sid === seasonId && Number(expires) > now;
}

const toSession = (c: typeof checkins.$inferSelect): AttendanceSession => ({
  checkInAt: c.checkInAt,
  checkOutAt: c.checkOutAt,
  autoClosed: c.autoClosed,
  approved: c.approved,
  rejected: c.rejected,
});

export async function toggleCheckin(
  viewer: Viewer,
  position: { lat: number; lng: number } | null,
): Promise<{ kind: "in" | "out"; at: Date }> {
  if (!viewer.season || !viewer.player) throw new AccessError("Du er ikke påmeldt");
  if (viewer.season.phase !== "running") throw new GameError("Oppmøte registreres bare mens spillet pågår");
  if (viewer.player.status !== "alive") throw new GameError("Du er ute av spillet og trenger ikke sjekke inn");
  const now = new Date();
  const today = osloDate(now);
  const seasonId = viewer.season.id;
  const playerId = viewer.player.id;
  const settings = viewer.season.settings;

  return db.transaction(async (tx) => {
    await tx.select({ id: players.id }).from(players).where(eq(players.id, playerId)).for("update");
    const [open] = await tx
      .select()
      .from(checkins)
      .where(and(eq(checkins.playerId, playerId), isNull(checkins.checkOutAt), eq(checkins.autoClosed, false)))
      .orderBy(desc(checkins.checkInAt))
      .limit(1);
    if (open && osloDate(open.checkInAt) === today) {
      await tx.update(checkins).set({ checkOutAt: now }).where(eq(checkins.id, open.id));
      return { kind: "out" as const, at: now };
    }
    const flags: string[] = [];
    let distance: number | null = null;
    if (!position) flags.push("Posisjon nektet eller utilgjengelig");
    else if (settings.office) {
      distance = Math.round(distanceMeters(position, settings.office));
      if (distance > settings.office.radiusMeters) flags.push(`Langt fra kontoret (${distance} m)`);
    }
    await tx.insert(checkins).values({ seasonId, playerId, checkInAt: now, flags, distanceMeters: distance });
    return { kind: "in" as const, at: now };
  });
}

export async function myAttendance(viewer: Viewer, now = new Date()) {
  if (!viewer.season || !viewer.player) return null;
  const weekStart = weekStartOf(now);
  const rules = await rulesForWeek(viewer.season, weekStart);
  const rows = await db
    .select()
    .from(checkins)
    .where(
      and(
        eq(checkins.playerId, viewer.player.id),
        gte(checkins.checkInAt, osloTime(weekStart, "00:00")),
        lt(checkins.checkInAt, osloTime(addDays(weekStart, 7), "00:00")),
      ),
    )
    .orderBy(asc(checkins.checkInAt));
  const days = dayResults(rows.map(toSession), weekStart, rules, now);
  const today = osloDate(now);
  const todays = rows.filter((r) => osloDate(r.checkInAt) === today);
  const open = todays.find((r) => !r.checkOutAt && !r.autoClosed) ?? null;
  return { weekStart, rules, days, todays, open, required: rules.days, counted: days.filter((d) => d.counts).length };
}

export async function closeForgottenSessions(now = new Date()) {
  const open = await db
    .select({ checkin: checkins })
    .from(checkins)
    .where(and(isNull(checkins.checkOutAt), eq(checkins.autoClosed, false)));
  for (const { checkin } of open) {
    const season = await db.query.seasons.findFirst({ where: (s, { eq: e }) => e(s.id, checkin.seasonId) });
    if (!season) continue;
    const rules = await rulesForWeek(season, weekStartOf(checkin.checkInAt));
    const close = closeTimeFor(checkin.checkInAt, rules);
    if (close <= now) {
      await db
        .update(checkins)
        .set({ checkOutAt: close < checkin.checkInAt ? checkin.checkInAt : close, autoClosed: true })
        .where(eq(checkins.id, checkin.id));
    }
  }
}

export async function weekSessions(seasonId: string, weekStart: string) {
  return db
    .select({ checkin: checkins, name: players.name })
    .from(checkins)
    .innerJoin(players, eq(players.id, checkins.playerId))
    .where(
      and(
        eq(checkins.seasonId, seasonId),
        gte(checkins.checkInAt, osloTime(weekStart, "00:00")),
        lt(checkins.checkInAt, osloTime(addDays(weekStart, 7), "00:00")),
      ),
    )
    .orderBy(asc(players.name), asc(checkins.checkInAt));
}

export async function sessionsForPlayers(seasonId: string, weekStart: string) {
  const rows = await weekSessions(seasonId, weekStart);
  const map = new Map<string, AttendanceSession[]>();
  for (const { checkin } of rows) {
    const list = map.get(checkin.playerId) ?? [];
    list.push(toSession(checkin));
    map.set(checkin.playerId, list);
  }
  return map;
}

type Edit =
  | { kind: "approve" }
  | { kind: "reject" }
  | { kind: "restore" }
  | { kind: "reviewed" }
  | { kind: "times"; checkInAt: Date; checkOutAt: Date | null };

export async function editCheckin(viewer: Viewer, checkinId: string, edit: Edit) {
  if (!viewer.season || !viewer.isStaff) throw new AccessError();
  const set: Partial<typeof checkins.$inferInsert> = { editedBy: viewer.user.id };
  if (edit.kind === "approve") Object.assign(set, { approved: true, rejected: false, flagsReviewed: true });
  if (edit.kind === "reject") Object.assign(set, { rejected: true, approved: false, flagsReviewed: true });
  if (edit.kind === "restore") Object.assign(set, { rejected: false, approved: false });
  if (edit.kind === "reviewed") Object.assign(set, { flagsReviewed: true });
  if (edit.kind === "times") {
    if (edit.checkOutAt && edit.checkOutAt <= edit.checkInAt) throw new GameError("Utsjekk må være etter innsjekk");
    Object.assign(set, { checkInAt: edit.checkInAt, checkOutAt: edit.checkOutAt, approved: true, autoClosed: false });
  }
  await db.update(checkins).set(set).where(and(eq(checkins.id, checkinId), eq(checkins.seasonId, viewer.season.id)));
  await audit(db, { seasonId: viewer.season.id, actorUserId: viewer.user.id, action: `oppmote.${edit.kind}`, details: { checkinId } });
}

export async function addManualCheckin(viewer: Viewer, playerId: string, checkInAt: Date, checkOutAt: Date) {
  if (!viewer.season || !viewer.isStaff) throw new AccessError();
  if (checkOutAt <= checkInAt) throw new GameError("Utsjekk må være etter innsjekk");
  const player = await db.query.players.findFirst({
    where: and(eq(players.id, playerId), eq(players.seasonId, viewer.season.id)),
  });
  if (!player) throw new GameError("Deltakeren finnes ikke");
  await db.insert(checkins).values({
    seasonId: viewer.season.id,
    playerId,
    checkInAt,
    checkOutAt,
    approved: true,
    flags: ["Lagt inn manuelt"],
    flagsReviewed: true,
    editedBy: viewer.user.id,
  });
  await audit(db, { seasonId: viewer.season.id, actorUserId: viewer.user.id, action: "oppmote.manuell", details: { playerId } });
}

export async function recentBoardScans(seasonId: string, now = new Date(), windowMs = 8000) {
  const since = new Date(now.getTime() - windowMs);
  const rows = await db
    .select({ playerId: checkins.playerId, name: players.name, checkInAt: checkins.checkInAt, checkOutAt: checkins.checkOutAt, autoClosed: checkins.autoClosed })
    .from(checkins)
    .innerJoin(players, eq(players.id, checkins.playerId))
    .where(and(eq(checkins.seasonId, seasonId), gte(checkins.createdAt, new Date(now.getTime() - 12 * 3600_000))));
  const events: { playerId: string; name: string; kind: "in" | "out"; at: Date }[] = [];
  for (const r of rows) {
    if (r.checkInAt >= since) events.push({ playerId: r.playerId, name: r.name, kind: "in", at: r.checkInAt });
    if (r.checkOutAt && !r.autoClosed && r.checkOutAt >= since) events.push({ playerId: r.playerId, name: r.name, kind: "out", at: r.checkOutAt });
  }
  return events.sort((a, b) => b.at.getTime() - a.at.getTime());
}
