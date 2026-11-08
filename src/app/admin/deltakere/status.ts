import { imageState } from "@/game/review";

export const STATUS = {
  alive: ["Med", "green"],
  eliminated: ["Eliminert", "zinc"],
  disqualified: ["Diskvalifisert", "red"],
} as const;

const IMAGE = {
  rejected: { label: "Bilde avvist", tone: "red" },
  approved: { label: "Bilde godkjent", tone: "green" },
  pending: { label: "Bilde venter", tone: "amber" },
} as const;

export function imageStatus(p: Parameters<typeof imageState>[0]) {
  const state = imageState(p);
  return state === "deleted" ? null : IMAGE[state];
}
