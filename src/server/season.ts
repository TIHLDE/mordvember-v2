import "server-only";
import { and, desc, eq, lte } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
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

export async function closeExpiredSignups(now = new Date()) {
  await db
    .update(seasons)
    .set({ phase: "closed" })
    .where(and(eq(seasons.phase, "signup"), lte(seasons.signupDeadline, now)));
}

export const getCurrentSeason = cache(async () => {
  await closeExpiredSignups();
  return (await db.query.seasons.findFirst({ orderBy: desc(seasons.createdAt) })) ?? null;
});

export function signupOpen(season: { phase: Phase; signupDeadline: Date | null }, now = new Date()): boolean {
  return season.phase === "signup" && (!season.signupDeadline || season.signupDeadline > now);
}

export async function rulesForWeek(season: { id: string; settings: SeasonSettings }, weekStart: string): Promise<WeekRules> {
  const override = await db.query.weekRules.findFirst({
    where: and(eq(weekRules.seasonId, season.id), eq(weekRules.weekStart, weekStart)),
  });
  return { ...DEFAULT_RULES, ...season.settings.defaultRules, ...(override?.rules ?? {}) };
}
