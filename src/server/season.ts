import "@tanstack/react-start/server-only";
import { and, desc, eq, lte } from "drizzle-orm";
import { cache } from "react";
import { db, type Tx } from "@/db";
import { type SeasonSettings, seasons, weekRules } from "@/db/schema";
export { defaultSettings } from "@/db/defaults";
import { DEFAULT_RULES, type WeekRules } from "@/game/attendance";

export const PHASES = [
  { key: "setup", label: "Oppsett" },
  { key: "signup", label: "Påmelding åpen" },
  { key: "closed", label: "Påmelding stengt" },
  { key: "running", label: "Spill pågår" },
  { key: "ended", label: "Avsluttet" },
] as const;

export type Phase = (typeof PHASES)[number]["key"];

export function phaseLabel(phase: Phase): string {
  return PHASES.find((p) => p.key === phase)?.label ?? phase;
}

export const getCurrentSeason = cache(async () => {
  return (await db.query.seasons.findFirst({ orderBy: desc(seasons.createdAt) })) ?? null;
});

export function signupOpen(season: { phase: Phase }): boolean {
  return season.phase === "signup";
}

// The game has one ruleset. Changes made while the game is underway are stored from that week on, so earlier weeks keep the rules they had.
// Inside a transaction, pass it in: on Vercel the pool has a single connection, so reaching for `db` deadlocks.
export async function rulesForWeek(
  season: { id: string; settings: SeasonSettings },
  weekStart: string,
  conn: Tx | typeof db = db,
): Promise<WeekRules> {
  const change = await conn.query.weekRules.findFirst({
    where: and(eq(weekRules.seasonId, season.id), lte(weekRules.weekStart, weekStart)),
    orderBy: desc(weekRules.weekStart),
  });
  return { ...DEFAULT_RULES, ...season.settings.defaultRules, ...(change?.rules ?? {}) };
}
