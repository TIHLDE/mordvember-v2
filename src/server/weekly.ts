import "server-only";
import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { jobRuns, kills, players, weeklyReviews, users } from "@/db/schema";
import { evaluateWeek, type WeekEvaluation } from "@/game/attendance";
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
          gte(kills.killedAt, osloTime(weekStart, "00:00")),
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

export async function sendThursdayWarnings(season: Season, weekStart: string, now = new Date()) {
  const results = await evaluateSeasonWeek(season, weekStart, now);
  for (const { player, evaluation } of results) {
    if (evaluation.ok) continue;
    // Eget krav per deltaker, så et nytt forsøk etter en feil halvveis ikke varsler noen to ganger.
    await db.transaction(async (tx) => {
      const [claimed] = await tx.insert(jobRuns).values({ key: `torsdag:${season.id}:${weekStart}:${player.id}` }).onConflictDoNothing().returning();
      if (!claimed) return;
      await notify(tx, [{ userId: player.userId, seasonId: season.id, text: `Du ligger an til å ryke: ${evaluation.missing.join(", ")}`, href: "/oppmote" }]);
      await queueEmail(tx, "weekly_warning", [player.email], { mangler: evaluation.missing.join("\n") });
    });
  }
}

export async function buildFridayList(season: Season, weekStart: string, now = new Date()) {
  const results = await evaluateSeasonWeek(season, weekStart, now);
  const failing = results.filter((r) => !r.evaluation.ok);
  if (failing.length) {
    await db
      .insert(weeklyReviews)
      .values(failing.map((f) => ({ seasonId: season.id, weekStart, playerId: f.player.id, reasons: f.evaluation.missing })))
      .onConflictDoNothing();
  }
  const staffRows = await staffEmails(db, season.id);
  await notify(
    db,
    staffRows.map((s) => ({
      userId: s.userId,
      seasonId: season.id,
      text: `Fredagslista er klar: ${failing.length} deltaker${failing.length === 1 ? "" : "e"} må gås gjennom.`,
      href: "/admin/fredag",
    })),
  );
  return failing.length;
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
