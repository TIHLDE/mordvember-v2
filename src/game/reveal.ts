import type { Rng } from "./ring";

export const REVEAL_MIN_MINUTES = 15;
export const REVEAL_MAX_MINUTES = 60;

export function revealAt(confirmedAt: Date, rng: Rng): Date {
  const minutes = REVEAL_MIN_MINUTES + rng() * (REVEAL_MAX_MINUTES - REVEAL_MIN_MINUTES);
  return new Date(confirmedAt.getTime() + Math.round(minutes * 60000));
}

export function isVisiblyOut(player: { status: string; revealAt: Date | null }, now: Date): boolean {
  if (player.status === "alive") return false;
  return player.revealAt === null || player.revealAt <= now;
}
