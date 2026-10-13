import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { players, staff, users } from "@/db/schema";
import { getCurrentSeason } from "../season";
import type { PhotonIdentity } from "./photon";
import { startSession } from "./session";

export async function onLogin(identity: PhotonIdentity) {
  const userId = await startSession(identity);
  if (!identity.isKokLeader) return;
  const season = await getCurrentSeason();
  if (!season) return;
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const isPlayer = await db.query.players.findFirst({ where: and(eq(players.seasonId, season.id), eq(players.userId, userId)) });
  if (user && !isPlayer) {
    await db.insert(staff).values({ seasonId: season.id, username: user.username, role: "gamemaster" }).onConflictDoNothing();
  }
}
