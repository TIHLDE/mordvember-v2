import { seasonForScreenToken } from "@/server/admin";
import { playerImageResponse } from "@/server/player-image";

export async function GET(_: Request, { params }: { params: Promise<{ token: string; playerId: string }> }) {
  const { token, playerId } = await params;
  const season = await seasonForScreenToken(token);
  if (!season) return new Response("Ikke funnet", { status: 404 });
  return playerImageResponse(season.id, playerId);
}
