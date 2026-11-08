import "@tanstack/react-start/server-only";
import { and, asc, desc, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { jobRuns, kills, players, weeklyReviews, users } from "@/db/schema";
import { evaluateWeek, weeklyWarningDue, type WeekEvaluation } from "@/game/attendance";
import { fridayListDueAt, listWeekError } from "@/game/friday";
import { addDays, osloTime } from "@/game/time";
import { audit } from "./audit";
import { AccessError, type Season, type Viewer } from "./auth/session";
import { queueEmail } from "./email";
import { disqualify, GameError, staffEmails } from "./game";
import { notify } from "./notify";
import { rulesForWeek } from "./season";
import { sessionsForPlayers } from "./attendance";

export async function claimJob(key: string): Promise<boolean> {
  const inserted = await db.insert(jobRuns).values({ key }).onConflictDoNothing().returning();
  return inserted.length > 0;
}

export async function releaseJob(key: string) {
  await db.delete(jobRuns).where(eq(jobRuns.key, key));
}

export async function evaluateSeasonWeek(season: Season, weekStart: string, now = new Date()) {
  const [rules, alive, sessions, applied] = await Promise.all([
    rulesForWeek(season, weekStart),
    db
      .select({ id: players.id, name: players.name, userId: players.userId, email: users.email, requirementsFromWeek: players.requirementsFromWeek })
      .from(players)
      .innerJoin(users, eq(users.id, players.userId))
      .where(and(eq(players.seasonId, season.id), eq(players.status, "alive")))
      .orderBy(asc(players.name)),
    sessionsForPlayers(season.id, weekStart),
    db
      .select({ killerId: kills.killerId, killedAt: kills.killedAt })
      .from(kills)
      .where(
        and(
          eq(kills.seasonId, season.id),
          eq(kills.status, "applied"),
          lt(kills.killedAt, osloTime(addDays(weekStart, 7), "00:00")),
        ),
      ),
  ]);
  return alive.map((p) => ({
    player: p,
    evaluation: evaluateWeek({
      weekStart,
      requirementsFromWeek: p.requirementsFromWeek,
      sessions: sessions.get(p.id) ?? [],
      killTimes: applied.filter((k) => k.killerId === p.id).map((k) => k.killedAt),
      rules,
      now,
    }) satisfies WeekEvaluation,
  }));
}

export async function sendWeeklyWarnings(season: Season, weekStart: string, now = new Date()) {
  const results = await evaluateSeasonWeek(season, weekStart, now);
  const rules = await rulesForWeek(season, weekStart);
  for (const { player, evaluation } of results) {
    if (!weeklyWarningDue(evaluation, rules, now, weekStart)) continue;
    // Eget krav per deltaker, så et nytt forsøk etter en feil halvveis ikke varsler noen to ganger.
    await db.transaction(async (tx) => {
      const [claimed] = await tx.insert(jobRuns).values({ key: `torsdag:${season.id}:${weekStart}:${player.id}` }).onConflictDoNothing().returning();
      if (!claimed) return;
      await notify(tx, [{ userId: player.userId, seasonId: season.id, text: `Du ligger an til å ryke: ${evaluation.missing.join(", ")}`, href: "/oppmote" }]);
      await queueEmail(tx, "weekly_warning", [player.email], { mangler: evaluation.missing.join("\n") });
    });
  }
}

const fridayJobKey = (seasonId: string, weekStart: string) => `fredag:${seasonId}:${weekStart}`;

// Reviews that exist are never touched, so decisions stand and a repeat run only adds players missing from the list.
// The claim sits in the same transaction as the list: a run that fails leaves nothing behind, and a concurrent run
// waits on the key, then finds nothing new and stays quiet. A list made before the Friday deadline neither claims
// nor notifies, since the week is not over and cron must still make the real one and announce it.
async function buildFridayList(season: Season, weekStart: string, now: Date) {
  const results = await evaluateSeasonWeek(season, weekStart, now);
  const failing = results.filter((r) => !r.evaluation.ok);
  const complete = now >= fridayListDueAt(weekStart);
  return db.transaction(async (tx) => {
    const [claimed] = complete
      ? await tx.insert(jobRuns).values({ key: fridayJobKey(season.id, weekStart) }).onConflictDoNothing().returning()
      : [];
    const added = failing.length
      ? await tx
          .insert(weeklyReviews)
          .values(failing.map((f) => ({ seasonId: season.id, weekStart, playerId: f.player.id, reasons: f.evaluation.missing })))
          .onConflictDoNothing()
          .returning({ id: weeklyReviews.id })
      : [];
    const pending = await tx.$count(
      weeklyReviews,
      and(eq(weeklyReviews.seasonId, season.id), eq(weeklyReviews.weekStart, weekStart), eq(weeklyReviews.decision, "pending")),
    );
    if (claimed || (complete && added.length)) {
      const staffRows = await staffEmails(tx, season.id);
      await notify(
        tx,
        staffRows.map((s) => ({
          userId: s.userId,
          seasonId: season.id,
          text: `Fredagslista er klar: ${pending} deltaker${pending === 1 ? "" : "e"} må gås gjennom.`,
          href: "/admin/fredag",
        })),
      );
    }
    return { claimed: !!claimed, existed: complete && !claimed, added: added.length, pending };
  });
}

export async function buildFridayListOnce(season: Season, weekStart: string, now = new Date()) {
  const built = await db.query.jobRuns.findFirst({ where: eq(jobRuns.key, fridayJobKey(season.id, weekStart)) });
  if (built) return false;
  return (await buildFridayList(season, weekStart, now)).claimed;
}

export async function buildFridayListManually(viewer: Viewer, weekStart: string, now = new Date()) {
  if (!viewer.season || !viewer.isGamemaster) throw new AccessError();
  const season = viewer.season;
  if (season.phase !== "running" || !season.startedAt) throw new GameError("Fredagslista kan bare lages mens spillet pågår");
  const invalid = listWeekError(weekStart, season.startedAt, now);
  if (invalid) throw new GameError(invalid);
  const result = await buildFridayList(season, weekStart, now);
  await audit(db, { seasonId: season.id, actorUserId: viewer.user.id, action: "fredag.liste", details: { weekStart, nye: result.added } });
  return result;
}

// Only the claim shows that a week was evaluated: a week where everyone passed has no reviews,
// and a list made before the deadline has reviews but no claim.
export async function missingFridayLists(seasonId: string, weeks: string[]) {
  if (!weeks.length) return [];
  const built = await db.select({ key: jobRuns.key }).from(jobRuns).where(inArray(jobRuns.key, weeks.map((w) => fridayJobKey(seasonId, w))));
  const keys = new Set(built.map((b) => b.key));
  return weeks.filter((w) => !keys.has(fridayJobKey(seasonId, w)));
}

export async function reviews(seasonId: string) {
  return db
    .select({ review: weeklyReviews, name: players.name, status: players.status })
    .from(weeklyReviews)
    .innerJoin(players, eq(players.id, weeklyReviews.playerId))
    .where(eq(weeklyReviews.seasonId, seasonId))
    .orderBy(desc(weeklyReviews.weekStart), asc(players.name));
}

export async function decideReview(viewer: Viewer, reviewId: string, decision: "disqualified" | "exception", reason: string) {
  if (!viewer.season || !viewer.isGamemaster) throw new AccessError();
  if (!reason.trim()) throw new GameError("Skriv en begrunnelse");
  const review = await db.query.weeklyReviews.findFirst({
    where: and(eq(weeklyReviews.id, reviewId), eq(weeklyReviews.seasonId, viewer.season.id)),
  });
  if (!review || review.decision !== "pending") throw new GameError("Saken er allerede avgjort");
  if (decision === "disqualified") {
    const player = await db.query.players.findFirst({ where: eq(players.id, review.playerId) });
    if (player?.status === "alive") await disqualify(viewer, [review.playerId], reason.trim());
  }
  await db
    .update(weeklyReviews)
    .set({ decision, decisionReason: reason.trim(), decidedBy: viewer.user.id, decidedAt: new Date() })
    .where(eq(weeklyReviews.id, reviewId));
  await audit(db, { seasonId: viewer.season.id, actorUserId: viewer.user.id, action: `fredag.${decision}`, details: { reviewId } });
}

export async function pendingReviewCount(seasonId: string) {
  return db.$count(weeklyReviews, and(eq(weeklyReviews.seasonId, seasonId), inArray(weeklyReviews.decision, ["pending"])));
}
