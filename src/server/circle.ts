import "@tanstack/react-start/server-only";
import { desc, eq, inArray, sql as dsql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { circleEvents, circles, players, users } from "@/db/schema";
import { changedTargets, type Ring, targetOf } from "@/game/ring";
import { audit } from "./audit";
import { AccessError, type Viewer } from "./auth/session";
import { queueEmail } from "./email";
import { notify, playerRecipients } from "./notify";

export async function lockRing(tx: Tx, seasonId: string): Promise<Ring> {
  const rows = await tx.execute<{ ring: string[] }>(
    dsql`select ring from circles where season_id = ${seasonId} for update`,
  );
  return rows[0]?.ring ?? [];
}

export async function hasRing(seasonId: string): Promise<boolean> {
  const row = await db.query.circles.findFirst({
    where: eq(circles.seasonId, seasonId),
    columns: { version: true },
  });
  return !!row;
}

export async function commitRing(
  tx: Tx,
  input: {
    seasonId: string;
    before: Ring;
    after: Ring;
    type: string;
    actorUserId: string | null;
    payload?: Record<string, unknown>;
    announce: boolean;
  },
) {
  await tx
    .insert(circles)
    .values({ seasonId: input.seasonId, ring: [...input.after], version: 1 })
    .onConflictDoUpdate({
      target: circles.seasonId,
      set: { ring: [...input.after], version: dsql`${circles.version} + 1`, updatedAt: new Date() },
    });
  await tx.insert(circleEvents).values({
    seasonId: input.seasonId,
    type: input.type,
    actorUserId: input.actorUserId,
    payload: input.payload ?? {},
    ringBefore: [...input.before],
    ringAfter: [...input.after],
  });
  if (input.announce) await announceNewTargets(tx, input.seasonId, input.before, input.after);
}

async function announceNewTargets(tx: Tx, seasonId: string, before: Ring, after: Ring) {
  const hunters = changedTargets(before, after).map((c) => c.hunterId);
  await announceTargets(tx, seasonId, hunters, "new_target");
}

export async function announceTargets(
  tx: Tx,
  seasonId: string,
  playerIds: string[],
  template: "new_target" | "game_start",
) {
  if (!playerIds.length) return;
  const rows = await playerRecipients(tx, playerIds);
  await notify(
    tx,
    rows.map((r) => ({
      userId: r.userId,
      seasonId,
      text:
        template === "game_start"
          ? "Spillet har startet. Ditt første offer er klart."
          : "Du har fått et nytt offer.",
      href: "/offer",
    })),
  );
  await queueEmail(
    tx,
    template,
    rows.map((r) => r.email),
  );
}

async function ringForServer(seasonId: string): Promise<Ring> {
  const row = await db.query.circles.findFirst({ where: eq(circles.seasonId, seasonId) });
  return row?.ring ?? [];
}

export async function myTarget(
  viewer: Viewer,
): Promise<{ id: string; name: string; bio: string | null } | null> {
  if (!viewer.season || !viewer.player || viewer.player.status !== "alive") return null;
  if (viewer.season.phase !== "running") return null;
  const ring = await ringForServer(viewer.season.id);
  const targetId = targetOf(ring, viewer.player.id);
  if (!targetId) return null;
  const target = await db.query.players.findFirst({
    where: eq(players.id, targetId),
    columns: { id: true, name: true, bio: true },
  });
  return target ?? null;
}

export type CircleEntry = { id: string; name: string; killCount: number; targetId: string | null };

export async function circleForAdmin(viewer: Viewer, reason: string): Promise<CircleEntry[]> {
  if (!viewer.season || !viewer.canSeeCircle)
    throw new AccessError("Bare spillmestere har tilgang til sirkelen");
  const ring = await ringForServer(viewer.season.id);
  await audit(db, {
    seasonId: viewer.season.id,
    actorUserId: viewer.user.id,
    action: "sirkel.vist",
    details: { visning: reason, nodtilgang: !viewer.isGamemaster },
  });
  if (!ring.length) return [];
  const rows = await db
    .select({ id: players.id, name: players.name, killCount: players.killCount })
    .from(players)
    .where(inArray(players.id, [...ring]));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ring.map((id) => ({
    id,
    name: byId.get(id)?.name ?? "Ukjent",
    killCount: byId.get(id)?.killCount ?? 0,
    targetId: targetOf(ring, id),
  }));
}

export async function circleEventsForAdmin(viewer: Viewer) {
  if (!viewer.season || !viewer.canSeeCircle)
    throw new AccessError("Bare spillmestere har tilgang til sirkelen");
  return db
    .select({
      id: circleEvents.id,
      type: circleEvents.type,
      payload: circleEvents.payload,
      createdAt: circleEvents.createdAt,
      actor: users.name,
      size: dsql<number>`jsonb_array_length(${circleEvents.ringAfter})`,
    })
    .from(circleEvents)
    .leftJoin(users, eq(users.id, circleEvents.actorUserId))
    .where(eq(circleEvents.seasonId, viewer.season.id))
    .orderBy(desc(circleEvents.createdAt))
    .limit(100);
}
