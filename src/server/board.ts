import "@tanstack/react-start/server-only";
import { and, desc, eq, isNotNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { players } from "@/db/schema";
import type { Season } from "./auth/session";
import { gridPlayers, visibleAliveCount } from "./players";

export async function boardData(season: Season) {
  const [grid, [lastOut]] = await Promise.all([
    gridPlayers(season.id),
    db
      .select({ id: players.id, name: players.name, at: players.eliminatedAt })
      .from(players)
      .where(
        and(
          eq(players.seasonId, season.id),
          ne(players.status, "alive"),
          isNotNull(players.eliminatedAt),
        ),
      )
      .orderBy(desc(players.eliminatedAt))
      .limit(1),
  ]);
  const winnerVisible = season.winnerPlayerId && grid.filter((p) => !p.out).length === 1;

  return {
    seasonName: season.name,
    phase: season.phase,
    players: grid,
    alive: visibleAliveCount(grid),
    lastOut: lastOut ? { id: lastOut.id, name: lastOut.name, at: lastOut.at!.toISOString() } : null,
    winner: winnerVisible ? (grid.find((p) => !p.out)?.name ?? null) : null,
  };
}

export type BoardData = Awaited<ReturnType<typeof boardData>>;
