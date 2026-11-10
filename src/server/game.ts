import "@tanstack/react-start/server-only";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { kills, players, seasons, staff, users } from "@/db/schema";
import {
  canBeDisqualified,
  checkReport,
  decideOnConfirm,
  isOpen,
  type KillCase,
} from "@/game/kills";
import {
  applyKill,
  generateRing,
  insertAfter,
  movePlayer,
  randomInsertAfter,
  removePlayers,
  type Ring,
  RingError,
  undoKill,
} from "@/game/ring";
import { addDays, weekStartOf } from "@/game/time";
import { audit } from "./audit";
import { AccessError, type Season, type Viewer } from "./auth/session";
import { announceTargets, commitRing, lockRing } from "./circle";
import { queueEmail } from "./email";
import { notify, playerRecipients } from "./notify";

export { hasRing } from "./circle";

export class GameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameError";
  }
}

const rng = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 4294967296;

function assertGamemaster(viewer: Viewer): asserts viewer is Viewer & { season: Season } {
  if (!viewer.season || !viewer.isGamemaster)
    throw new AccessError("Bare spillmestere kan gjøre dette");
}

// A stopped game has still started: circle changes are announced, so nobody keeps hunting an old target when it resumes.
function hasStarted(season: Season) {
  return season.phase === "running" || season.phase === "ended";
}

async function lockSeason(tx: Tx, seasonId: string): Promise<Season> {
  const [season] = await tx.select().from(seasons).where(eq(seasons.id, seasonId)).for("update");
  if (!season) throw new GameError("Sesongen finnes ikke");
  return season;
}

export async function staffEmails(
  tx: Tx | typeof db,
  seasonId: string,
): Promise<{ userId: string; email: string | null }[]> {
  return tx
    .select({ userId: users.id, email: users.email })
    .from(staff)
    .innerJoin(users, eq(users.username, staff.username))
    .where(eq(staff.seasonId, seasonId));
}

async function notifyStaff(
  tx: Tx,
  seasonId: string,
  text: string,
  href: string,
  email?: { reason: string },
) {
  const rows = await staffEmails(tx, seasonId);
  await notify(
    tx,
    rows.map((r) => ({ userId: r.userId, seasonId, text, href })),
  );
  if (email)
    await queueEmail(
      tx,
      "staff_case",
      rows.map((r) => r.email),
      { grunn: email.reason },
    );
}

export async function generateCircle(viewer: Viewer) {
  assertGamemaster(viewer);
  const seasonId = viewer.season.id;
  await db.transaction(async (tx) => {
    const season = await lockSeason(tx, seasonId);
    if (season.phase !== "closed")
      throw new GameError("Sirkelen kan bare trekkes når påmeldingen er stengt");
    const before = await lockRing(tx, seasonId);
    const after = generateRing(await aliveIds(tx, seasonId), rng);
    await commitRing(tx, {
      seasonId,
      before,
      after,
      type: "trukket",
      actorUserId: viewer.user.id,
      announce: false,
    });
    await audit(tx, {
      seasonId,
      actorUserId: viewer.user.id,
      action: "sirkel.trukket",
      details: { deltakere: after.length },
    });
  });
}

export async function moveInCircle(viewer: Viewer, playerId: string, afterId: string) {
  assertGamemaster(viewer);
  const seasonId = viewer.season.id;
  await db.transaction(async (tx) => {
    const season = await lockSeason(tx, seasonId);
    const before = await lockRing(tx, seasonId);
    const after = movePlayer(before, playerId, afterId);
    await commitRing(tx, {
      seasonId,
      before,
      after,
      type: "flyttet",
      actorUserId: viewer.user.id,
      payload: { playerId, afterId },
      announce: hasStarted(season),
    });
    await audit(tx, {
      seasonId,
      actorUserId: viewer.user.id,
      action: "sirkel.flyttet",
      details: { playerId, afterId },
    });
  });
}

export async function startGame(viewer: Viewer) {
  assertGamemaster(viewer);
  const seasonId = viewer.season.id;
  await db.transaction(async (tx) => {
    const season = await lockSeason(tx, seasonId);
    if (season.phase !== "closed")
      throw new GameError("Spillet kan bare startes fra «Påmelding stengt»");
    const ring = await lockRing(tx, seasonId);
    await assertRingMatchesPlayers(tx, seasonId, ring);
    await tx
      .update(seasons)
      .set({ phase: "running", startedAt: new Date() })
      .where(eq(seasons.id, seasonId));
    await announceTargets(tx, seasonId, [...ring], "game_start");
    await audit(tx, { seasonId, actorUserId: viewer.user.id, action: "sesong.startet" });
  });
}

// Resuming a stopped game. A disqualification while it was stopped can leave one survivor, who is crowned now.
export async function resumeGame(viewer: Viewer) {
  assertGamemaster(viewer);
  const seasonId = viewer.season.id;
  await db.transaction(async (tx) => {
    const season = await lockSeason(tx, seasonId);
    if (season.phase !== "ended") throw new GameError("Spillet er ikke stoppet");
    const ring = await lockRing(tx, seasonId);
    await assertRingMatchesPlayers(tx, seasonId, ring, 1);
    await tx.update(seasons).set({ phase: "running" }).where(eq(seasons.id, seasonId));
    await crownIfWinner(tx, seasonId, ring);
    await audit(tx, {
      seasonId,
      actorUserId: viewer.user.id,
      action: "sesong.fase",
      details: { phase: "running" },
    });
  });
}

// The circle must hold exactly the living players.
async function assertRingMatchesPlayers(tx: Tx, seasonId: string, ring: Ring, minPlayers = 2) {
  const alive = new Set(await aliveIds(tx, seasonId));
  if (
    ring.length < minPlayers ||
    ring.length !== alive.size ||
    !ring.every((id) => alive.has(id))
  ) {
    throw new GameError("Sirkelen stemmer ikke med deltakerlista. Trekk sirkelen på nytt.");
  }
}

async function aliveIds(tx: Tx, seasonId: string): Promise<string[]> {
  const rows = await tx
    .select({ id: players.id })
    .from(players)
    .where(and(eq(players.seasonId, seasonId), eq(players.status, "alive")));
  return rows.map((p) => p.id);
}

async function crownIfWinner(tx: Tx, seasonId: string, ring: Ring) {
  if (ring.length !== 1) return;
  await tx.update(seasons).set({ winnerPlayerId: ring[0] }).where(eq(seasons.id, seasonId));
}

function toCase(k: typeof kills.$inferSelect): KillCase {
  return {
    id: k.id,
    killerId: k.killerId,
    victimId: k.victimId,
    killedAt: k.killedAt,
    reportedBy: k.reportedBy,
    reportedAt: k.reportedAt,
    status: k.status,
  };
}

async function seasonKills(tx: Tx, seasonId: string): Promise<KillCase[]> {
  return (await tx.select().from(kills).where(eq(kills.seasonId, seasonId))).map(toCase);
}

async function userOfPlayer(tx: Tx, playerId: string) {
  const [row] = await tx
    .select({ userId: users.id, email: users.email, name: players.name })
    .from(players)
    .innerJoin(users, eq(users.id, players.userId))
    .where(eq(players.id, playerId));
  if (!row) throw new GameError("Deltakeren finnes ikke");
  return row;
}

export async function reportKill(viewer: Viewer, role: "killer" | "victim", killedAt: Date) {
  if (!viewer.season || !viewer.player) throw new AccessError("Du er ikke påmeldt");
  if (Number.isNaN(killedAt.getTime())) throw new GameError("Ugyldig tidspunkt");
  const seasonId = viewer.season.id;
  const reporterId = viewer.player.id;
  await db.transaction(async (tx) => {
    const season = await lockSeason(tx, seasonId);
    if (season.phase !== "running") throw new GameError("Spillet er ikke i gang");
    const ring = await lockRing(tx, seasonId);
    const all = await seasonKills(tx, seasonId);
    const check = checkReport(ring, reporterId, role, all);
    if (!check.ok) throw new GameError(check.reason);
    if (killedAt.getTime() > Date.now() + 5 * 60_000)
      throw new GameError("Tidspunktet kan ikke være i framtiden");
    await tx.insert(kills).values({
      seasonId,
      killerId: check.killerId,
      victimId: check.victimId,
      killedAt,
      reportedBy: role,
    });
    const other = await userOfPlayer(tx, role === "killer" ? check.victimId : check.killerId);
    await notify(tx, [
      {
        userId: other.userId,
        seasonId,
        text:
          role === "killer"
            ? "Noen har meldt at de har tatt deg. Bekreft eller si fra om det ikke stemmer."
            : "Offeret ditt har meldt at du har tatt hen. Bekreft drapet.",
        href: "/drap",
      },
    ]);
    await queueEmail(tx, "kill_confirm", [other.email]);
  });
}

async function applyKillTx(
  tx: Tx,
  season: Season,
  kill: typeof kills.$inferSelect,
  approverId: string | null,
  note?: string,
) {
  const before = await lockRing(tx, season.id);
  let after: Ring;
  try {
    after = applyKill(before, kill.killerId, kill.victimId);
  } catch (error) {
    if (error instanceof RingError) {
      throw new GameError(
        "Offeret er ikke lenger morderens offer. Rett sirkelen før drapet godkjennes.",
      );
    }
    throw error;
  }
  const now = new Date();
  await tx
    .update(players)
    .set({ status: "eliminated", eliminatedAt: now })
    .where(eq(players.id, kill.victimId));
  await tx
    .update(players)
    .set({ killCount: sql`${players.killCount} + 1` })
    .where(eq(players.id, kill.killerId));
  await tx
    .update(kills)
    .set({
      status: "applied",
      confirmedAt: kill.confirmedAt ?? now,
      resolvedAt: now,
      approvedBy: approverId,
      resolutionNote: note ?? null,
    })
    .where(eq(kills.id, kill.id));
  await commitRing(tx, {
    seasonId: season.id,
    before,
    after,
    type: "drap",
    actorUserId: approverId,
    payload: { killId: kill.id },
    announce: true,
  });
  const victim = await userOfPlayer(tx, kill.victimId);
  await notify(tx, [
    {
      userId: victim.userId,
      seasonId: season.id,
      text: "Drapet på deg er bekreftet. Du er ute av spillet.",
      href: "/",
    },
  ]);
  await queueEmail(tx, "eliminated", [victim.email]);
  await crownIfWinner(tx, season.id, after);
}

async function lockKill(tx: Tx, seasonId: string, killId: string) {
  const [kill] = await tx
    .select()
    .from(kills)
    .where(and(eq(kills.id, killId), eq(kills.seasonId, seasonId)))
    .for("update");
  return kill;
}

async function loadOpenKill(tx: Tx, seasonId: string, killId: string) {
  const kill = await lockKill(tx, seasonId, killId);
  if (!kill || !isOpen(toCase(kill))) throw new GameError("Saken er allerede avgjort");
  return kill;
}

export async function confirmKill(viewer: Viewer, killId: string) {
  if (!viewer.season || !viewer.player) throw new AccessError("Du er ikke påmeldt");
  const seasonId = viewer.season.id;
  const me = viewer.player.id;
  await db.transaction(async (tx) => {
    const season = await lockSeason(tx, seasonId);
    if (season.phase !== "running") throw new GameError("Spillet er ikke i gang");
    const kill = await loadOpenKill(tx, seasonId, killId);
    const confirmer = kill.reportedBy === "killer" ? kill.victimId : kill.killerId;
    if (confirmer !== me) throw new AccessError("Du kan ikke bekrefte denne saken");
    if (kill.status !== "pending") throw new GameError("Saken ligger hos spillmesterne");
    const ring = await lockRing(tx, seasonId);
    const all = await seasonKills(tx, seasonId);
    const decision = decideOnConfirm(toCase(kill), ring, all, season.startedAt, new Date());
    if (decision.action === "escalate") {
      await tx
        .update(kills)
        .set({ status: "escalated", confirmedAt: new Date(), escalationReasons: decision.reasons })
        .where(eq(kills.id, kill.id));
      await notifyStaff(
        tx,
        seasonId,
        "En drapssak er flagget og trenger en avgjørelse.",
        "/admin/drap",
        {
          reason: decision.reasons.join(", "),
        },
      );
      return;
    }
    await applyKillTx(tx, season, { ...kill, confirmedAt: new Date() }, null);
  });
}

export async function disputeKill(viewer: Viewer, killId: string) {
  if (!viewer.season || !viewer.player) throw new AccessError("Du er ikke påmeldt");
  const seasonId = viewer.season.id;
  const me = viewer.player.id;
  await db.transaction(async (tx) => {
    const kill = await loadOpenKill(tx, seasonId, killId);
    if (kill.killerId !== me && kill.victimId !== me)
      throw new AccessError("Du er ikke part i denne saken");
    const reason =
      kill.victimId === me
        ? "Offeret sier at drapet ikke stemmer"
        : "Morderen sier at drapet ikke stemmer";
    await tx
      .update(kills)
      .set({ status: "escalated", escalationReasons: [...kill.escalationReasons, reason] })
      .where(eq(kills.id, kill.id));
    await notifyStaff(
      tx,
      seasonId,
      "En drapssak er bestridt og trenger en avgjørelse.",
      "/admin/drap",
      { reason },
    );
  });
}

export async function approveKill(viewer: Viewer, killId: string, note: string) {
  assertGamemaster(viewer);
  const seasonId = viewer.season.id;
  await db.transaction(async (tx) => {
    const season = await lockSeason(tx, seasonId);
    if (season.phase !== "running") throw new GameError("Spillet er ikke i gang");
    const kill = await loadOpenKill(tx, seasonId, killId);
    await applyKillTx(tx, season, kill, viewer.user.id, note || undefined);
    await audit(tx, {
      seasonId,
      actorUserId: viewer.user.id,
      action: "drap.godkjent",
      details: { killId, note },
    });
  });
}

export async function rejectKill(viewer: Viewer, killId: string, note: string) {
  assertGamemaster(viewer);
  const seasonId = viewer.season.id;
  await db.transaction(async (tx) => {
    const kill = await loadOpenKill(tx, seasonId, killId);
    await tx
      .update(kills)
      .set({
        status: "rejected",
        resolvedAt: new Date(),
        approvedBy: viewer.user.id,
        resolutionNote: note || null,
      })
      .where(eq(kills.id, kill.id));
    const parties = await Promise.all([
      userOfPlayer(tx, kill.killerId),
      userOfPlayer(tx, kill.victimId),
    ]);
    await notify(
      tx,
      parties.map((p) => ({
        userId: p.userId,
        seasonId,
        text: "En drapssak du var part i ble avvist av spillmesterne.",
        href: "/drap",
      })),
    );
    await audit(tx, {
      seasonId,
      actorUserId: viewer.user.id,
      action: "drap.avvist",
      details: { killId, note },
    });
  });
}

/**
 * Gives the killer the kill without eliminating the victim, for when a kill was valid by the
 * rules but the gamemasters let the victim live (for example because a rule was unclear).
 * The ring is left as it is; move the victim in the circle afterwards if needed.
 */
export async function creditKill(viewer: Viewer, killId: string, note: string) {
  assertGamemaster(viewer);
  const seasonId = viewer.season.id;
  await db.transaction(async (tx) => {
    const season = await lockSeason(tx, seasonId);
    if (season.phase !== "running") throw new GameError("Spillet er ikke i gang");
    const kill = await loadOpenKill(tx, seasonId, killId);
    const now = new Date();
    await tx
      .update(kills)
      .set({
        status: "credited",
        confirmedAt: kill.confirmedAt ?? now,
        resolvedAt: now,
        approvedBy: viewer.user.id,
        resolutionNote: note || null,
      })
      .where(eq(kills.id, kill.id));
    await tx
      .update(players)
      .set({ killCount: sql`${players.killCount} + 1` })
      .where(eq(players.id, kill.killerId));
    const [killer, victim] = await Promise.all([
      userOfPlayer(tx, kill.killerId),
      userOfPlayer(tx, kill.victimId),
    ]);
    await notify(tx, [
      {
        userId: killer.userId,
        seasonId,
        text: "Spillmesterne har gitt deg drapet, men offeret ditt lever videre.",
        href: "/drap",
      },
      {
        userId: victim.userId,
        seasonId,
        text: "Spillmesterne har latt deg leve videre etter en drapssak. Du er fortsatt med.",
        href: "/drap",
      },
    ]);
    await audit(tx, {
      seasonId,
      actorUserId: viewer.user.id,
      action: "drap.kreditert",
      details: { killId, note },
    });
  });
}

export async function undoKillAsGamemaster(viewer: Viewer, killId: string) {
  assertGamemaster(viewer);
  const seasonId = viewer.season.id;
  await db.transaction(async (tx) => {
    const season = await lockSeason(tx, seasonId);
    const kill = await lockKill(tx, seasonId, killId);
    if (kill?.status === "credited") {
      // Offeret ble aldri tatt ut, så bare drapet trekkes fra morderen.
      await tx
        .update(players)
        .set({ killCount: sql`greatest(${players.killCount} - 1, 0)` })
        .where(eq(players.id, kill.killerId));
      await tx
        .update(kills)
        .set({ status: "undone", resolvedAt: new Date() })
        .where(eq(kills.id, kill.id));
      const killer = await userOfPlayer(tx, kill.killerId);
      await notify(tx, [
        {
          userId: killer.userId,
          seasonId,
          text: "Et drap du ble gitt av spillmesterne er trukket tilbake.",
          href: "/drap",
        },
      ]);
      await audit(tx, {
        seasonId,
        actorUserId: viewer.user.id,
        action: "drap.angret",
        details: { killId, kreditert: true },
      });
      return;
    }
    if (!kill || kill.status !== "applied")
      throw new GameError("Bare gjennomførte drap kan angres");
    const before = await lockRing(tx, seasonId);
    let after: Ring;
    try {
      after = undoKill(before, kill.killerId, kill.victimId);
    } catch (error) {
      if (error instanceof RingError) throw new GameError(error.message);
      throw error;
    }
    await tx
      .update(players)
      .set({ status: "alive", eliminatedAt: null })
      .where(eq(players.id, kill.victimId));
    await tx
      .update(players)
      .set({ killCount: sql`greatest(${players.killCount} - 1, 0)` })
      .where(eq(players.id, kill.killerId));
    await tx
      .update(kills)
      .set({ status: "undone", resolvedAt: new Date() })
      .where(eq(kills.id, kill.id));
    if (season.winnerPlayerId)
      await tx.update(seasons).set({ winnerPlayerId: null }).where(eq(seasons.id, seasonId));
    await commitRing(tx, {
      seasonId,
      before,
      after,
      type: "drap_angret",
      actorUserId: viewer.user.id,
      payload: { killId },
      announce: hasStarted(season),
    });
    const victim = await userOfPlayer(tx, kill.victimId);
    await notify(tx, [
      {
        userId: victim.userId,
        seasonId,
        text: "Et drap på deg er angret. Du er med i spillet igjen.",
        href: "/offer",
      },
    ]);
    await audit(tx, {
      seasonId,
      actorUserId: viewer.user.id,
      action: "drap.angret",
      details: { killId },
    });
  });
}

export async function grantMercy(viewer: Viewer, playerId: string, afterId: string | null) {
  assertGamemaster(viewer);
  const seasonId = viewer.season.id;
  await db.transaction(async (tx) => {
    const season = await lockSeason(tx, seasonId);
    if (season.phase !== "running") throw new GameError("Nåde kan bare gis mens spillet pågår");
    const [player] = await tx
      .select()
      .from(players)
      .where(and(eq(players.id, playerId), eq(players.seasonId, seasonId)));
    if (!player) throw new GameError("Deltakeren finnes ikke");
    const before = await lockRing(tx, seasonId);
    if (before.length < 2) throw new GameError("Spillet er avgjort");
    const after = afterId
      ? insertAfter(before, playerId, afterId)
      : randomInsertAfter(before, playerId, rng);
    const nextWeek = addDays(weekStartOf(new Date()), 7);
    await tx
      .update(players)
      .set({ status: "alive", eliminatedAt: null, requirementsFromWeek: nextWeek })
      .where(eq(players.id, playerId));
    await commitRing(tx, {
      seasonId,
      before,
      after,
      type: "nade",
      actorUserId: viewer.user.id,
      payload: { playerId, afterId },
      announce: true,
    });
    await audit(tx, {
      seasonId,
      actorUserId: viewer.user.id,
      action: "deltaker.nade",
      details: { playerId, valgtPlass: !!afterId },
    });
  });
}

export async function disqualify(viewer: Viewer, playerIds: string[], reason: string) {
  assertGamemaster(viewer);
  if (!reason.trim()) throw new GameError("Skriv en begrunnelse");
  const seasonId = viewer.season.id;
  await db.transaction(async (tx) => {
    const season = await lockSeason(tx, seasonId);
    const targets = await tx
      .select({ id: players.id })
      .from(players)
      .where(
        and(
          eq(players.seasonId, seasonId),
          eq(players.status, "alive"),
          inArray(players.id, playerIds),
        ),
      );
    if (!playerIds.length || targets.length !== new Set(playerIds).size) {
      throw new GameError("Bare levende deltakere i denne sesongen kan diskvalifiseres");
    }
    const all = await seasonKills(tx, seasonId);
    for (const id of playerIds) {
      if (!canBeDisqualified(id, all))
        throw new GameError("En deltaker har en uavklart drapssak. Avgjør den først.");
    }
    const before = await lockRing(tx, seasonId);
    const ringIds = new Set(before);
    const inRing = playerIds.filter((id) => ringIds.has(id));
    const after = inRing.length ? removePlayers(before, inRing) : before;
    const now = new Date();
    await tx
      .update(players)
      .set({ status: "disqualified", eliminatedAt: now })
      .where(and(eq(players.seasonId, seasonId), inArray(players.id, playerIds)));
    if (inRing.length) {
      await commitRing(tx, {
        seasonId,
        before,
        after,
        type: "diskvalifisert",
        actorUserId: viewer.user.id,
        payload: { playerIds: inRing },
        announce: hasStarted(season),
      });
      if (season.phase === "running") await crownIfWinner(tx, seasonId, after);
    }
    const disqualified = await playerRecipients(tx, playerIds);
    await notify(
      tx,
      disqualified.map((p) => ({
        userId: p.userId,
        seasonId,
        text: `Du er diskvalifisert. Begrunnelse: ${reason}`,
        href: "/",
      })),
    );
    await queueEmail(
      tx,
      "disqualified",
      disqualified.map((p) => p.email),
      { grunn: reason },
    );
    await audit(tx, {
      seasonId,
      actorUserId: viewer.user.id,
      action: "deltaker.diskvalifisert",
      details: { playerIds, reason },
    });
  });
}

export async function addPlayerAsGamemaster(viewer: Viewer, userId: string) {
  assertGamemaster(viewer);
  const seasonId = viewer.season.id;
  await db.transaction(async (tx) => {
    const season = await lockSeason(tx, seasonId);
    const [user] = await tx.select().from(users).where(eq(users.id, userId));
    if (!user) throw new GameError("Brukeren finnes ikke");
    const isGamemaster = await tx.query.staff.findFirst({
      where: and(eq(staff.seasonId, seasonId), eq(staff.username, user.username)),
    });
    if (isGamemaster) throw new GameError("En spillmester kan ikke være deltaker");
    // Once the game has started, including while it is stopped, the circle is fixed and new players join as already out.
    const started = hasStarted(season);
    const [player] = await tx
      .insert(players)
      .values({
        seasonId,
        userId,
        name: user.name,
        studyProgram: user.studyProgram,
        studyStartYear: user.studyStartYear,
        consentAt: new Date(),
        status: started ? "eliminated" : "alive",
        eliminatedAt: started ? new Date() : null,
      })
      .onConflictDoNothing()
      .returning();
    if (!player) throw new GameError("Brukeren er allerede påmeldt");
    await audit(tx, {
      seasonId,
      actorUserId: viewer.user.id,
      action: "deltaker.lagt_til",
      details: { playerId: player.id },
    });
  });
}

export async function removePlayerAsGamemaster(viewer: Viewer, playerId: string) {
  assertGamemaster(viewer);
  const seasonId = viewer.season.id;
  await db.transaction(async (tx) => {
    const season = await lockSeason(tx, seasonId);
    const before = await lockRing(tx, seasonId);
    if (before.includes(playerId)) {
      if (season.phase === "running")
        throw new GameError("Deltakeren er i sirkelen. Diskvalifiser i stedet.");
      const after = removePlayers(before, [playerId]);
      await commitRing(tx, {
        seasonId,
        before,
        after,
        type: "fjernet",
        actorUserId: viewer.user.id,
        payload: { playerId },
        announce: false,
      });
    }
    const hasKills = await tx.query.kills.findFirst({
      where: or(eq(kills.killerId, playerId), eq(kills.victimId, playerId)),
    });
    if (hasKills) throw new GameError("Deltakeren har drapssaker og kan ikke fjernes");
    await tx.delete(players).where(and(eq(players.id, playerId), eq(players.seasonId, seasonId)));
    await audit(tx, {
      seasonId,
      actorUserId: viewer.user.id,
      action: "deltaker.fjernet",
      details: { playerId },
    });
  });
}

export async function openKillsForPlayer(seasonId: string, playerId: string) {
  return db
    .select()
    .from(kills)
    .where(
      and(
        eq(kills.seasonId, seasonId),
        or(eq(kills.killerId, playerId), eq(kills.victimId, playerId)),
        inArray(kills.status, ["pending", "escalated"]),
      ),
    );
}
