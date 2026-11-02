import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import QRCode from "qrcode";
import { and, asc, desc, eq, gte, isNull, lt, lte } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { checkins, players, seasons } from "@/db/schema";
import { type AttendanceSession, closeTimeFor, dayResults, distanceMeters, GLOSHAUGEN } from "@/game/attendance";
import { qrCode, verifyQrCode } from "@/game/qr";
import { addDays, osloDate, osloTime, weekStartOf } from "@/game/time";
import { audit } from "./audit";
import { AccessError, type Viewer } from "./auth/session";
import { env } from "./env";
import { GameError } from "./game";
import { rulesForWeek } from "./season";

export const PENDING_SCAN_COOKIE = "mv_scan";
export const SCAN_RESULT_COOKIE = "mv_scan_result";
export const PENDING_SCAN_MS = 10 * 60 * 1000;

function boardQr(seasonId: string, now = Date.now()) {
  const code = qrCode(env.qrSecret, seasonId, now);
  return { code, url: `${env.appUrl}/api/sjekkinn?k=${encodeURIComponent(code)}` };
}

export function boardQrSvg(seasonId: string, now = Date.now()) {
  return QRCode.toString(boardQr(seasonId, now).url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
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

// A forgotten session ends when its day's window did and is flagged, so it gives no credit unless a gamemaster approves it.
// Only an open session is closed, so a check-out that got in first keeps its time.
async function closeForgotten(tx: Tx | typeof db, checkin: { id: string; checkInAt: Date }, close: Date) {
  await tx
    .update(checkins)
    .set({ checkOutAt: close < checkin.checkInAt ? checkin.checkInAt : close, autoClosed: true })
    .where(and(eq(checkins.id, checkin.id), isNull(checkins.checkOutAt)));
}

export async function toggleCheckin(
  viewer: Viewer,
  position: { lat: number; lng: number } | null,
  intent: "in" | "out",
  now = new Date(),
): Promise<{ kind: "in" | "out" | "forgotten"; at: Date }> {
  if (!viewer.season || !viewer.player) throw new AccessError("Du er ikke påmeldt");
  if (viewer.season.phase !== "running") throw new GameError("Oppmøte registreres bare mens spillet pågår");
  if (viewer.player.status !== "alive") throw new GameError("Du er ute av spillet og trenger ikke sjekke inn");
  const today = osloDate(now);
  const season = viewer.season;
  const seasonId = season.id;
  const playerId = viewer.player.id;
  const office = season.settings.office ?? GLOSHAUGEN;

  return db.transaction(async (tx) => {
    await tx.select({ id: players.id }).from(players).where(eq(players.id, playerId)).for("update");
    const [open] = await tx
      .select()
      .from(checkins)
      .where(and(eq(checkins.playerId, playerId), isNull(checkins.checkOutAt), eq(checkins.autoClosed, false)))
      .orderBy(desc(checkins.checkInAt))
      .limit(1);
    if (open && osloDate(open.checkInAt) === today) {
      if (intent === "in") throw new GameError("Du er allerede sjekket inn");
      await tx.update(checkins).set({ checkOutAt: now }).where(eq(checkins.id, open.id));
      return { kind: "out" as const, at: now };
    }
    // Left open from an earlier day because cron hasn't reached it yet.
    if (open) await closeForgotten(tx, open, closeTimeFor(open.checkInAt, await rulesForWeek(season, weekStartOf(open.checkInAt), tx)));
    if (intent === "out") {
      if (open) return { kind: "forgotten" as const, at: now };
      throw new GameError("Du er ikke sjekket inn");
    }
    // The QR code is public on the status screen, so the position is what proves the player is there.
    if (!position) throw new GameError("Fant ikke posisjonen din. Tillat posisjon i nettleseren og last inn siden på nytt.");
    const distance = Math.round(distanceMeters(position, office));
    if (distance > office.radiusMeters) throw new GameError(`Du må være på Gløshaugen for å sjekke inn. Du er ${distance} m unna.`);
    await tx.insert(checkins).values({ seasonId, playerId, checkInAt: now, flags: [], distanceMeters: distance });
    return { kind: "in" as const, at: now };
  });
}

export async function myAttendance(viewer: Viewer, now = new Date()) {
  if (!viewer.season || !viewer.player) return null;
  const weekStart = weekStartOf(now);
  const today = osloDate(now);
  const [rules, rows, [stale = null]] = await Promise.all([
    rulesForWeek(viewer.season, weekStart),
    db
      .select()
      .from(checkins)
      .where(
        and(
          eq(checkins.playerId, viewer.player.id),
          gte(checkins.checkInAt, osloTime(weekStart, "00:00")),
          lt(checkins.checkInAt, osloTime(addDays(weekStart, 7), "00:00")),
        ),
      )
      .orderBy(asc(checkins.checkInAt)),
    // Read on its own, since a session left open on a Friday is still open in the week after.
    db
      .select()
      .from(checkins)
      .where(
        and(
          eq(checkins.playerId, viewer.player.id),
          isNull(checkins.checkOutAt),
          eq(checkins.autoClosed, false),
          lt(checkins.checkInAt, osloTime(today, "00:00")),
        ),
      )
      .orderBy(desc(checkins.checkInAt))
      .limit(1),
  ]);
  const days = dayResults(rows.map(toSession), weekStart, rules, now);
  const todays = rows.filter((r) => osloDate(r.checkInAt) === today);
  const open = todays.find((r) => !r.checkOutAt && !r.autoClosed) ?? null;
  return { weekStart, rules, days, todays, open, stale, required: rules.days, counted: days.filter((d) => d.counts).length };
}

// A session forgotten on an earlier day stays open until cron reaches it, but says nothing about today.
// Gamemasters can also move a session's start ahead of now, and it hasn't begun until then.
const openToday = (now: Date) =>
  and(
    isNull(checkins.checkOutAt),
    eq(checkins.autoClosed, false),
    gte(checkins.checkInAt, osloTime(osloDate(now), "00:00")),
    lte(checkins.checkInAt, now),
  );

// Takes any player, so a caller must only pass the viewer's own current target. That target comes from myTarget.
export async function isCheckedIn(playerId: string, now = new Date()) {
  const [open] = await db
    .select({ id: checkins.id })
    .from(checkins)
    .where(and(eq(checkins.playerId, playerId), openToday(now)))
    .limit(1);
  return !!open;
}

// Shows everyone's whereabouts, so it is for gamemaster pages only.
export async function checkedInPlayers(seasonId: string, now = new Date()) {
  const rows = await db
    .select({ playerId: checkins.playerId })
    .from(checkins)
    .where(and(eq(checkins.seasonId, seasonId), openToday(now)));
  return new Set(rows.map((r) => r.playerId));
}

export async function closeForgottenSessions(now = new Date()) {
  const open = await db
    .select({ checkin: checkins, season: seasons })
    .from(checkins)
    .innerJoin(seasons, eq(seasons.id, checkins.seasonId))
    .where(and(isNull(checkins.checkOutAt), eq(checkins.autoClosed, false)));
  // Open check-ins mostly share a season and week, so each set of rules is read once.
  const rules = new Map<string, ReturnType<typeof rulesForWeek>>();
  const rulesFor = (season: (typeof open)[number]["season"], weekStart: string) => {
    const key = `${season.id}:${weekStart}`;
    if (!rules.has(key)) rules.set(key, rulesForWeek(season, weekStart));
    return rules.get(key)!;
  };
  await Promise.all(
    open.map(async ({ checkin, season }) => {
      const close = closeTimeFor(checkin.checkInAt, await rulesFor(season, weekStartOf(checkin.checkInAt)));
      if (close > now) return;
      await closeForgotten(db, checkin, close);
    }),
  );
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
  if (!viewer.season || !viewer.isGamemaster) throw new AccessError();
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
  if (!viewer.season || !viewer.isGamemaster) throw new AccessError();
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
