import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/db";
import { emergencyAccess, players, seasons, sessions, staff, users } from "@/db/schema";
import { getCurrentSeason } from "../season";
import type { PhotonIdentity } from "./photon";

export const SESSION_COOKIE = "mv_session";
const SESSION_DAYS = 3;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function startSession(identity: PhotonIdentity): Promise<string> {
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
    expiresAt: new Date(Date.now() + SESSION_DAYS * 86400_000),
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  return user.id;
}

export async function endSession() {
  const jar = await cookies();
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
  season: Season | null;
  player: Player | null;
  staffRole: "gamemaster" | "organizer" | null;
  isGamemaster: boolean;
  isOrganizer: boolean;
  isStaff: boolean;
  emergencyUntil: Date | null;
  canSeeCircle: boolean;
  canManageRoles: boolean;
};

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const jar = await cookies();
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
  let staffRole: Viewer["staffRole"] = null;
  if (season) {
    player = (await db.query.players.findFirst({
      where: and(eq(players.seasonId, season.id), eq(players.userId, user.id)),
    })) ?? null;
    const staffRow = await db.query.staff.findFirst({
      where: and(eq(staff.seasonId, season.id), eq(staff.username, user.username)),
    });
    staffRole = staffRow?.role ?? null;
  }

  let emergencyUntil: Date | null = null;
  if (session.isIndexLeader) {
    const active = await db.query.emergencyAccess.findFirst({
      where: and(eq(emergencyAccess.userId, user.id), gt(emergencyAccess.expiresAt, new Date()), isNull(emergencyAccess.endedAt)),
      orderBy: desc(emergencyAccess.startedAt),
    });
    emergencyUntil = active?.expiresAt ?? null;
  }

  const isGamemaster = staffRole === "gamemaster" || session.isKokLeader;
  const isOrganizer = staffRole === "organizer";
  return {
    user,
    isKokLeader: session.isKokLeader,
    isIndexLeader: session.isIndexLeader,
    season,
    player,
    staffRole,
    isGamemaster,
    isOrganizer,
    isStaff: isGamemaster || isOrganizer,
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

export async function requireStaff() {
  const viewer = await requireSeason();
  if (!viewer.isStaff) throw new AccessError();
  return viewer;
}

export async function requireGamemaster() {
  const viewer = await requireSeason();
  if (!viewer.isGamemaster) throw new AccessError("Bare spillmestere har tilgang til dette");
  return viewer;
}

export async function requireCircleAccess() {
  const viewer = await requireSeason();
  if (!viewer.canSeeCircle) throw new AccessError("Bare spillmestere har tilgang til sirkelen");
  return viewer;
}

export async function requirePlayer() {
  const viewer = await requireSeason();
  if (!viewer.player) throw new AccessError("Du er ikke påmeldt");
  return viewer as typeof viewer & { player: Player };
}
