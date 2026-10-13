export type Ring = readonly string[];

export class RingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RingError";
  }
}

export type Rng = () => number;

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

export function generateRing(playerIds: readonly string[], rng: Rng): Ring {
  if (new Set(playerIds).size !== playerIds.length) throw new RingError("Samme deltaker står flere ganger");
  if (playerIds.length < 2) throw new RingError("Det trengs minst to deltakere");
  return shuffle(playerIds, rng);
}

export function isSingleRing(ring: Ring, aliveIds: readonly string[]): boolean {
  if (new Set(ring).size !== ring.length) return false;
  if (ring.length !== aliveIds.length) return false;
  const alive = new Set(aliveIds);
  return ring.every((id) => alive.has(id));
}

export function targetsOf(ring: Ring): Map<string, string> {
  const map = new Map<string, string>();
  if (ring.length < 2) return map;
  ring.forEach((id, i) => map.set(id, ring[(i + 1) % ring.length] as string));
  return map;
}

export function targetOf(ring: Ring, playerId: string): string | null {
  const i = ring.indexOf(playerId);
  if (i === -1 || ring.length < 2) return null;
  return ring[(i + 1) % ring.length] as string;
}

export function hunterOf(ring: Ring, playerId: string): string | null {
  const i = ring.indexOf(playerId);
  if (i === -1 || ring.length < 2) return null;
  return ring[(i - 1 + ring.length) % ring.length] as string;
}

export function applyKill(ring: Ring, killerId: string, victimId: string): Ring {
  if (killerId === victimId) throw new RingError("En deltaker kan ikke drepe seg selv");
  if (targetOf(ring, killerId) !== victimId) throw new RingError("Offeret er ikke morderens nåværende offer");
  return ring.filter((id) => id !== victimId);
}

export function removePlayers(ring: Ring, playerIds: readonly string[]): Ring {
  const remove = new Set(playerIds);
  for (const id of remove) if (!ring.includes(id)) throw new RingError("Deltakeren er ikke i sirkelen");
  return ring.filter((id) => !remove.has(id));
}

export function insertAfter(ring: Ring, playerId: string, afterId: string): Ring {
  if (ring.includes(playerId)) throw new RingError("Deltakeren er allerede i sirkelen");
  const i = ring.indexOf(afterId);
  if (i === -1) throw new RingError("Plassen finnes ikke i sirkelen");
  return [...ring.slice(0, i + 1), playerId, ...ring.slice(i + 1)];
}

export function randomInsertAfter(ring: Ring, playerId: string, rng: Rng): Ring {
  if (ring.length === 0) throw new RingError("Sirkelen er tom");
  const afterId = ring[Math.floor(rng() * ring.length)] as string;
  return insertAfter(ring, playerId, afterId);
}

export function movePlayer(ring: Ring, playerId: string, afterId: string): Ring {
  if (playerId === afterId) throw new RingError("Kan ikke plassere en deltaker etter seg selv");
  if (!ring.includes(playerId)) throw new RingError("Deltakeren er ikke i sirkelen");
  return insertAfter(
    ring.filter((id) => id !== playerId),
    playerId,
    afterId,
  );
}

export function undoKill(ring: Ring, killerId: string, victimId: string): Ring {
  if (ring.includes(victimId)) throw new RingError("Offeret er allerede i sirkelen");
  if (!ring.includes(killerId)) {
    throw new RingError("Morderen er ikke lenger i sirkelen. Gi offeret nåde med valgt plass i stedet.");
  }
  return insertAfter(ring, victimId, killerId);
}

export type TargetChange = { hunterId: string; targetId: string };

export function changedTargets(before: Ring, after: Ring): TargetChange[] {
  const old = targetsOf(before);
  const changes: TargetChange[] = [];
  for (const [hunterId, targetId] of targetsOf(after)) {
    if (old.get(hunterId) !== targetId) changes.push({ hunterId, targetId });
  }
  return changes;
}
