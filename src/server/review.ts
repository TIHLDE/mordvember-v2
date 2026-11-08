import "@tanstack/react-start/server-only";
import { and, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { checkins, weeklyReviews } from "@/db/schema";
import { reviewItems } from "@/game/review";
import { formatOsloDate, osloDate, osloTime, weekStartOf } from "@/game/time";
import type { Viewer } from "./auth/session";
import { openKillsForPlayer } from "./game";

export async function myReviewItems(viewer: Viewer, now = new Date()) {
  if (!viewer.season || !viewer.player) return [];
  const { season, player } = viewer;
  const [kills, unclosed, reviews] = await Promise.all([
    openKillsForPlayer(season.id, player.id),
    db
      .select({ checkInAt: checkins.checkInAt })
      .from(checkins)
      .where(
        and(
          eq(checkins.playerId, player.id),
          eq(checkins.autoClosed, true),
          eq(checkins.approved, false),
          eq(checkins.rejected, false),
          eq(checkins.flagsReviewed, false),
          gte(checkins.checkInAt, osloTime(weekStartOf(now), "00:00")),
        ),
      ),
    db
      .select({ weekStart: weeklyReviews.weekStart })
      .from(weeklyReviews)
      .where(and(eq(weeklyReviews.playerId, player.id), eq(weeklyReviews.decision, "pending"))),
  ]);
  return reviewItems({
    playerId: player.id,
    alive: player.status === "alive",
    image: player,
    kills,
    unclosedCheckinDates: unclosed.map((c) => osloDate(c.checkInAt)),
    pendingReviewWeeks: player.status === "alive" ? reviews.map((r) => r.weekStart) : [],
    formatDate: formatOsloDate,
  });
}
