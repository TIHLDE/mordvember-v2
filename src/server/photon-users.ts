import "server-only";
import { PhotonForbiddenError, type PhotonUser, searchUsers } from "./auth/photon";
import { AccessError, currentPhotonToken, type Viewer } from "./auth/session";
import { GameError } from "./game";

export async function searchPhotonUsers(viewer: Viewer, query: string): Promise<PhotonUser[]> {
  if (!viewer.canManageRoles) throw new AccessError();
  const q = query.trim();
  if (q.length < 2 || q.length > 100) return [];
  const token = await currentPhotonToken();
  if (!token) throw new GameError("Logg ut og inn igjen for å søke i Photon.");
  const groupSlug = viewer.isKokLeader ? "kok" : viewer.isIndexLeader ? "index" : undefined;
  try {
    return await searchUsers(token, q, groupSlug);
  } catch (error) {
    if (error instanceof PhotonForbiddenError) throw new GameError("Photon lar deg ikke søke etter brukere. Skriv inn brukernavnet.");
    throw error;
  }
}
