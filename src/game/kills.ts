import { type Ring, targetOf } from "./ring";

export type KillStatus = "pending" | "escalated" | "applied" | "rejected" | "undone" | "credited";

/** Kills that count for the killer: normal ones, and ones credited while the victim lived on. */
export const COUNTED_KILL_STATUSES = ["applied", "credited"] as const;

export type KillCase = {
  id: string;
  killerId: string;
  victimId: string;
  killedAt: Date;
  reportedBy: "killer" | "victim";
  reportedAt: Date;
  status: KillStatus;
};

export const CONFIRM_TIMEOUT_MS = 12 * 60 * 60 * 1000;

export function isOpen(kill: KillCase): boolean {
  return kill.status === "pending" || kill.status === "escalated";
}

export function isOverdue(kill: KillCase, now: Date): boolean {
  return (
    kill.status === "pending" && now.getTime() - kill.reportedAt.getTime() >= CONFIRM_TIMEOUT_MS
  );
}

export function findCollisions(
  kill: KillCase,
  all: readonly KillCase[],
  gameStartedAt: Date | null,
  now: Date,
  alive: ReadonlySet<string> = new Set(),
): string[] {
  const reasons: string[] = [];
  // Et gjennomført drap på noen som lever igjen (nåde eller angring) er ikke lenger en motsigelse.
  const others = all.filter(
    (k) => k.id !== kill.id && (isOpen(k) || (k.status === "applied" && !alive.has(k.victimId))),
  );

  if (kill.killedAt.getTime() > now.getTime() + 5 * 60 * 1000)
    reasons.push("Drapstidspunktet er i framtiden");
  // Skjemaet oppgir tidspunkt på hele minutter, så starten rundes ned til samme presisjon.
  const startMinute = gameStartedAt ? Math.floor(gameStartedAt.getTime() / 60000) * 60000 : null;
  if (startMinute !== null && kill.killedAt.getTime() < startMinute)
    reasons.push("Drapstidspunktet er før spillet startet");

  if (others.some((k) => k.victimId === kill.victimId)) {
    reasons.push("Offeret er også meldt drept i en annen sak");
  }
  if (others.some((k) => k.victimId === kill.killerId && k.killedAt < kill.killedAt)) {
    reasons.push("Morderen er meldt drept før dette drapstidspunktet");
  }
  // Et kreditert drap lot offeret leve, men viser fortsatt at morderen var i live og drepte da.
  const actedLater = [...others, ...all.filter((k) => k.id !== kill.id && k.status === "credited")];
  if (actedLater.some((k) => k.killerId === kill.victimId && k.killedAt > kill.killedAt)) {
    reasons.push("Offeret har meldt et eget drap etter sitt eget dødstidspunkt");
  }
  return reasons;
}

export type ReportCheck =
  | { ok: true; killerId: string; victimId: string }
  | { ok: false; reason: string };

export function checkReport(
  ring: Ring,
  reporterId: string,
  role: "killer" | "victim",
  all: readonly KillCase[],
): ReportCheck {
  if (!ring.includes(reporterId)) return { ok: false, reason: "Du er ikke med i spillet lenger" };
  let killerId: string;
  let victimId: string;
  if (role === "killer") {
    const target = targetOf(ring, reporterId);
    if (!target) return { ok: false, reason: "Du har ikke noe offer" };
    killerId = reporterId;
    victimId = target;
  } else {
    const hunter = ring[(ring.indexOf(reporterId) - 1 + ring.length) % ring.length];
    if (!hunter || hunter === reporterId) return { ok: false, reason: "Ingen jakter på deg" };
    killerId = hunter;
    victimId = reporterId;
  }
  if (all.some((k) => isOpen(k) && k.killerId === killerId && k.victimId === victimId)) {
    return { ok: false, reason: "Dette drapet er allerede meldt og venter på bekreftelse" };
  }
  return { ok: true, killerId, victimId };
}

export type ConfirmOutcome = { action: "apply" } | { action: "escalate"; reasons: string[] };

export function decideOnConfirm(
  kill: KillCase,
  ring: Ring,
  all: readonly KillCase[],
  gameStartedAt: Date | null,
  now: Date,
): ConfirmOutcome {
  const reasons = findCollisions(kill, all, gameStartedAt, now, new Set(ring));
  if (targetOf(ring, kill.killerId) !== kill.victimId)
    reasons.push("Sirkelen har endret seg siden drapet ble meldt");
  return reasons.length ? { action: "escalate", reasons } : { action: "apply" };
}

export function canBeDisqualified(playerId: string, all: readonly KillCase[]): boolean {
  return !all.some((k) => isOpen(k) && (k.killerId === playerId || k.victimId === playerId));
}
