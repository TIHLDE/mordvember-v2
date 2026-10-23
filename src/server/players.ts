import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { players, seasons, users } from "@/db/schema";
import { audit } from "./audit";
import { AccessError, type Viewer } from "./auth/session";
import { queueEmail } from "./email";
import { STUDY_REPORT_ADDRESS } from "./env";
import { GameError } from "./game";
import { deleteImages, storeImage } from "./images";
import { notify } from "./notify";
import { signupOpen } from "./season";

export async function signUp(viewer: Viewer, input: { consent: boolean; image: File | null; bio: string | null }) {
  const season = viewer.season;
  if (!season || !signupOpen(season)) throw new GameError("Påmeldingen er ikke åpen");
  if (viewer.isGamemaster) throw new GameError("Spillmestere kan ikke delta");
  if (!input.consent) throw new GameError("Du må godta vilkårene for å melde deg på");
  if (viewer.player) throw new GameError("Du er allerede påmeldt");
  const player = await db.transaction(async (tx) => {
    // Checked again under a lock, so a signup racing a close or reset is not let in afterwards.
    const [current] = await tx.select({ phase: seasons.phase }).from(seasons).where(eq(seasons.id, season.id)).for("share");
    if (!current || !signupOpen(current)) throw new GameError("Påmeldingen er ikke åpen");
    const [inserted] = await tx
      .insert(players)
      .values({
        seasonId: season.id,
        userId: viewer.user.id,
        name: viewer.user.name,
        studyProgram: viewer.user.studyProgram,
        studyStartYear: viewer.user.studyStartYear,
        bio: input.bio,
        consentAt: new Date(),
      })
      .onConflictDoNothing()
      .returning();
    return inserted;
  });
  if (!player) throw new GameError("Du er allerede påmeldt");
  if (input.image && input.image.size > 0) {
    await setImage({ ...viewer, player }, input.image);
  }
}

export async function withdraw(viewer: Viewer) {
  if (!viewer.season || !viewer.player) throw new GameError("Du er ikke påmeldt");
  if (!signupOpen(viewer.season)) throw new GameError("Påmeldingen er stengt. Kontakt en spillmester for å melde deg av.");
  if (viewer.player.imageKey) await deleteImages([viewer.player.imageKey]);
  await db.delete(players).where(eq(players.id, viewer.player.id));
}

export async function setImage(viewer: Viewer, file: File) {
  if (!viewer.season || !viewer.player) throw new GameError("Du er ikke påmeldt");
  const key = await storeImage(`seasons/${viewer.season.id}/players/${viewer.player.id}`, file);
  if (viewer.player.imageKey) await deleteImages([viewer.player.imageKey]).catch(() => undefined);
  await db
    .update(players)
    .set({ imageKey: key, useDefaultImage: false, imageRejectedReason: null, imageApprovedAt: null, imageDeleted: false })
    .where(eq(players.id, viewer.player.id));
}

export async function chooseDefaultImage(viewer: Viewer) {
  if (!viewer.player) throw new GameError("Du er ikke påmeldt");
  if (viewer.player.imageKey) await deleteImages([viewer.player.imageKey]).catch(() => undefined);
  await db
    .update(players)
    .set({ imageKey: null, useDefaultImage: true, imageRejectedReason: null, imageApprovedAt: null })
    .where(eq(players.id, viewer.player.id));
}

export async function deleteOwnImage(viewer: Viewer) {
  if (!viewer.player) throw new GameError("Du er ikke påmeldt");
  if (viewer.player.status === "alive") throw new GameError("Bildet kan slettes når du er ute av spillet");
  if (viewer.player.imageKey) await deleteImages([viewer.player.imageKey]).catch(() => undefined);
  await db
    .update(players)
    .set({ imageKey: null, useDefaultImage: false, imageDeleted: true })
    .where(eq(players.id, viewer.player.id));
}

export async function setBio(viewer: Viewer, bio: string | null) {
  if (!viewer.player) throw new GameError("Du er ikke påmeldt");
  if (viewer.player.status !== "alive") throw new GameError("Du er ute av spillet");
  await db.update(players).set({ bio }).where(eq(players.id, viewer.player.id));
}

export async function reportWrongStudy(viewer: Viewer) {
  await queueEmail(db, "study_wrong", [STUDY_REPORT_ADDRESS], {
    brukernavn: viewer.user.username,
    studie: viewer.user.studyProgram ?? "mangler",
    kull: viewer.user.studyStartYear ?? "mangler",
  });
}

export async function rejectImage(viewer: Viewer, playerId: string, message: string) {
  if (!viewer.season || !viewer.isGamemaster) throw new AccessError();
  if (!message.trim()) throw new GameError("Skriv en kort melding til deltakeren");
  const [row] = await db
    .select({ player: players, email: users.email })
    .from(players)
    .innerJoin(users, eq(users.id, players.userId))
    .where(and(eq(players.id, playerId), eq(players.seasonId, viewer.season.id)));
  if (!row) throw new GameError("Deltakeren finnes ikke");
  await db.transaction(async (tx) => {
    await tx.update(players).set({ imageRejectedReason: message.trim(), imageApprovedAt: null }).where(eq(players.id, playerId));
    await notify(tx, [{ userId: row.player.userId, seasonId: viewer.season!.id, text: `Bildet ditt ble avvist: ${message.trim()}`, href: "/profil" }]);
    await queueEmail(tx, "image_rejected", [row.email], { melding: message.trim() });
    await audit(tx, { seasonId: viewer.season!.id, actorUserId: viewer.user.id, action: "bilde.avvist", details: { playerId } });
  });
}

export async function approveImage(viewer: Viewer, playerId: string) {
  if (!viewer.season || !viewer.isGamemaster) throw new AccessError();
  await db
    .update(players)
    .set({ imageApprovedAt: new Date(), imageRejectedReason: null })
    .where(and(eq(players.id, playerId), eq(players.seasonId, viewer.season.id)));
}

export type GridPlayer = { id: string; name: string; out: boolean };

export async function gridPlayers(seasonId: string): Promise<GridPlayer[]> {
  const rows = await db
    .select({ id: players.id, name: players.name, status: players.status })
    .from(players)
    .where(eq(players.seasonId, seasonId))
    .orderBy(asc(players.name));
  return rows.map((r) => ({ id: r.id, name: r.name, out: r.status !== "alive" }));
}

export function visibleAliveCount(grid: GridPlayer[]): number {
  return grid.filter((p) => !p.out).length;
}
