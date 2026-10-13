import "server-only";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { kills, milestoneEvents, players } from "@/db/schema";
import { osloDate } from "@/game/time";
import type { Season } from "./auth/session";
import { boardQr, recentBoardScans } from "./attendance";
import { gridPlayers, visibleAliveCount } from "./players";

const MILESTONE_SHOW_MS = 30_000;

export async function boardData(season: Season, now = new Date()) {
  const grid = await gridPlayers(season.id, now);
  const visibleKills = await db
    .select({ killerId: kills.killerId, killedAt: kills.killedAt })
    .from(kills)
    .innerJoin(players, eq(players.id, kills.victimId))
    .where(and(eq(kills.seasonId, season.id), eq(kills.status, "applied"), lte(players.revealAt, now)))
    .orderBy(desc(kills.killedAt));
  const killers = await db
    .select({ id: players.id, name: players.name })
    .from(players)
    .where(eq(players.seasonId, season.id));
  const today = osloDate(now);
  const todays = visibleKills.filter((k) => osloDate(k.killedAt) === today);
  const counts = new Map<string, number>();
  for (const k of todays) counts.set(k.killerId, (counts.get(k.killerId) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const stats = season.settings.stats;

  const milestone = await db.query.milestoneEvents.findFirst({
    where: and(
      eq(milestoneEvents.seasonId, season.id),
      lte(milestoneEvents.showAt, now),
      gte(milestoneEvents.showAt, new Date(now.getTime() - MILESTONE_SHOW_MS)),
    ),
    orderBy: desc(milestoneEvents.showAt),
  });
  const winnerVisible = season.winnerPlayerId && grid.filter((p) => !p.out).length === 1;

  return {
    seasonName: season.name,
    phase: season.phase,
    players: grid,
    alive: visibleAliveCount(grid),
    qr: season.phase === "running" ? boardQr(season.id, now.getTime()).url : null,
    scans: season.phase === "running" ? (await recentBoardScans(season.id, now)).map((s) => ({ ...s, at: s.at.toISOString() })) : [],
    milestone: milestone ? { label: milestone.label } : null,
    winner: winnerVisible ? (grid.find((p) => !p.out)?.name ?? null) : null,
    stats: {
      killsToday: stats.killsToday ? todays.length : null,
      sinceLastKill: stats.sinceLastKill ? (visibleKills[0]?.killedAt.toISOString() ?? null) : null,
      topKillerToday: stats.topKillerToday && top ? { name: killers.find((k) => k.id === top[0])?.name ?? "", kills: top[1] } : null,
    },
  };
}

export type BoardData = Awaited<ReturnType<typeof boardData>>;
