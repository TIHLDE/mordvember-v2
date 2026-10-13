import type { SeasonSettings } from "./schema";
import { DEFAULT_RULES } from "@/game/attendance";
import { DEFAULT_MILESTONES } from "@/game/milestones";

export function defaultSettings(): SeasonSettings {
  return {
    stats: { killsToday: true, sinceLastKill: true, topKillerToday: false },
    milestones: DEFAULT_MILESTONES.map((m) => ({ ...m })),
    defaultRules: { ...DEFAULT_RULES },
    office: null,
    info: {
      rules:
        "Hver deltaker får ett offer. Når du tar offeret ditt, melder du drapet i appen, og offerets offer blir ditt nye offer. Siste spiller igjen vinner. Spillmesterne fyller inn de fulle reglene her.\n\nDu må møte opp på kontoret minst to dager i uka, minst to timer sammenhengende mellom 08 og 16. Sjekk inn og ut med QR-koden på tavla.",
      dates: "",
    },
  };
}
