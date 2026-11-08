import "@tanstack/react-start/server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "@/server/cookies";
import { cache } from "react";
import { db } from "@/db";
import { emergencyAccess, players, seasons, sessions, staff, users } from "@/db/schema";
import { env } from "../env";
import { getCurrentSeason } from "../season";
import { type PhotonIdentity, PhotonUnauthorizedError, type PhotonTokens, refreshTokens } from "./photon";
import { seal, unseal } from "./token-box";

const SESSION_COOKIE = "mv_session";
const SESSION_DAYS = 3;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

function sealedTokens(tokens: PhotonTokens) {
  return {
    photonAccessToken: seal(tokens.accessToken),
    photonRefreshToken: tokens.refreshToken ? seal(tokens.refreshToken) : null,
    photonTokenExpiresAt: tokens.expiresAt,
  };
}

export async function startSession(identity: PhotonIdentity, tokens?: PhotonTokens): Promise<string> {
  const [user] = await db
    .insert(users)
    .values({
      username: identity.username,
      name: identity.name,
      email: identity.email,
      photonImage: identity.image,
      studyProgram: identity.studyProgram,
      studyStartYear: identity.studyStartYear,
      classYear: identity.classYear,
      lastLoginAt: new Date(),
    })
    .onConflictDoUpdate({
      target: users.username,
      set: {
        name: identity.name,
        email: identity.email,
        photonImage: identity.image,
        studyProgram: identity.studyProgram,
        studyStartYear: identity.studyStartYear,
        classYear: identity.classYear,
        lastLoginAt: new Date(),
      },
    })
    .returning();
  if (!user) throw new Error("Kunne ikke lagre brukeren");

  const token = randomBytes(32).toString("base64url");
  await db.insert(sessions).values({
    id: hash(token),
    userId: user.id,
    isKokLeader: identity.isKokLeader,
    isIndexLeader: identity.isIndexLeader,
    ...(tokens ? sealedTokens(tokens) : {}),
    expiresAt: new Date(Date.now() + SESSION_DAYS * 86400_000),
  });
  const jar = cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  return user.id;
}

export async function currentPhotonToken(): Promise<string | null> {
  const token = (cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const id = hash(token);
  const session = await db.query.sessions.findFirst({ where: and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())) });
  if (!session?.photonAccessToken) return null;
  if (session.photonTokenExpiresAt && session.photonTokenExpiresAt.getTime() > Date.now() + 60_000) {
    return unseal(session.photonAccessToken);
  }
  const refreshToken = session.photonRefreshToken ? unseal(session.photonRefreshToken) : null;
  if (!refreshToken) return null;
  const fresh = await refreshTokens(refreshToken).catch((error) => {
    if (error instanceof PhotonUnauthorizedError) throw error;
    console.error("Kunne ikke fornye Photon-tokenet", error);
    return null;
  });
  if (!fresh) return null;
  await db
    .update(sessions)
    .set(sealedTokens({ ...fresh, refreshToken: fresh.refreshToken ?? refreshToken }))
    .where(eq(sessions.id, id));
  return fresh.accessToken;
}

export async function endSession() {
  const jar = cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, hash(token)));
  jar.delete(SESSION_COOKIE);
}

export type Season = typeof seasons.$inferSelect;
export type Player = typeof players.$inferSelect;
export type User = typeof users.$inferSelect;

export type Viewer = {
  user: User;
  isKokLeader: boolean;
  isIndexLeader: boolean;
  isSuperadmin: boolean;
  season: Season | null;
  player: Player | null;
  isGamemaster: boolean;
  emergencyUntil: Date | null;
  canSeeCircle: boolean;
  canManageRoles: boolean;
};

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const jar = cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, hash(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const found = row[0];
  if (!found) return null;
  const { session, user } = found;

  const season = await getCurrentSeason();
  let player: Player | null = null;
  let isListedGamemaster = false;
  if (season) {
    player = (await db.query.players.findFirst({
      where: and(eq(players.seasonId, season.id), eq(players.userId, user.id)),
    })) ?? null;
    isListedGamemaster = !!(await db.query.staff.findFirst({
      where: and(eq(staff.seasonId, season.id), eq(staff.username, user.username)),
    }));
  }

  let emergencyUntil: Date | null = null;
  if (session.isIndexLeader) {
    const active = await db.query.emergencyAccess.findFirst({
      where: and(eq(emergencyAccess.userId, user.id), gt(emergencyAccess.expiresAt, new Date()), isNull(emergencyAccess.endedAt)),
      orderBy: desc(emergencyAccess.startedAt),
    });
    emergencyUntil = active?.expiresAt ?? null;
  }

  const isSuperadmin = env.superadmins.includes(user.username);
  const isGamemaster = isListedGamemaster || session.isKokLeader || isSuperadmin;
  return {
    user,
    isKokLeader: session.isKokLeader,
    isIndexLeader: session.isIndexLeader,
    isSuperadmin,
    season,
    player,
    isGamemaster,
    emergencyUntil,
    canSeeCircle: isGamemaster || emergencyUntil !== null,
    canManageRoles: session.isKokLeader || session.isIndexLeader || isGamemaster,
  };
});

export class AccessError extends Error {
  constructor(message = "Du har ikke tilgang til dette") {
    super(message);
    this.name = "AccessError";
  }
}

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new AccessError("Du må logge inn");
  return viewer;
}

export async function requireSeason(): Promise<Viewer & { season: Season }> {
  const viewer = await requireViewer();
  if (!viewer.season) throw new AccessError("Ingen sesong er opprettet");
  return viewer as Viewer & { season: Season };
}

export async function requireGamemaster() {
  const viewer = await requireSeason();
  if (!viewer.isGamemaster) throw new AccessError("Bare spillmestere har tilgang til dette");
  return viewer;
}

export async function requirePlayer() {
  const viewer = await requireSeason();
  if (!viewer.player) throw new AccessError("Du er ikke påmeldt");
  return viewer as typeof viewer & { player: Player };
}
