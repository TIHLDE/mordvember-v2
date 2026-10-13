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
        "Hver deltaker får ett offer. Ta offeret ditt ved å gi hen et drapsobjekt uten at noen andre ser det, og meld drapet i appen. Offeret ditt sitt offer blir ditt nye offer. Siste spiller igjen vinner.\n\nDu må møte opp på kontoret minst to dager i uka, minst to timer sammenhengende mellom 08 og 16. Sjekk inn og ut med QR-koden på tavla.",
      dates: "",
    },
  };
}
