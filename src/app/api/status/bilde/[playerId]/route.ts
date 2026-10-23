import { playerImageResponse } from "@/server/player-image";
import { getCurrentSeason } from "@/server/season";

export async function GET(_: Request, { params }: { params: Promise<{ playerId: string }> }) {
  const [{ playerId }, season] = await Promise.all([params, getCurrentSeason()]);
  if (!season) return new Response("Ikke funnet", { status: 404 });
  return playerImageResponse(season.id, playerId);
}
