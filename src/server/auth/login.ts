import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { players, staff, users } from "@/db/schema";
import { deleteImages, storeImage } from "../images";
import { getCurrentSeason } from "../season";
import { downloadPhotonImage, type PhotonIdentity, type PhotonTokens } from "./photon";
import { startSession } from "./session";

export async function onLogin(identity: PhotonIdentity, tokens?: PhotonTokens) {
  const userId = await startSession(identity, tokens);
  if (tokens) {
    await copyPhotonImage(userId, identity.image, tokens.accessToken).catch((error) =>
      console.error("Kunne ikke kopiere profilbildet fra Photon", error),
    );
  }
  if (!identity.isKokLeader) return;
  const season = await getCurrentSeason();
  if (!season) return;
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const isPlayer = await db.query.players.findFirst({ where: and(eq(players.seasonId, season.id), eq(players.userId, userId)) });
  if (user && !isPlayer) {
    await db.insert(staff).values({ seasonId: season.id, username: user.username }).onConflictDoNothing();
  }
}

// Photon-opplastede profilbilder er private, og brukerens token finnes bare under innloggingen.
async function copyPhotonImage(userId: string, image: string | null, token: string) {
  const file = image ? await downloadPhotonImage(image, token) : null;
  const key = file ? await storeImage("photon", file) : null;
  const [before] = await db.select({ key: users.photonImageKey }).from(users).where(eq(users.id, userId));
  await db.update(users).set({ photonImageKey: key }).where(eq(users.id, userId));
  if (before?.key && before.key !== key) await deleteImages([before.key]).catch(() => undefined);
}
