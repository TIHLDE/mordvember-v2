import { createFileRoute } from "@tanstack/react-router";
import { playerImageResponse } from "@/server/player-image";
import { getCurrentSeason } from "@/server/season";

 async function GET(_: Request, { params }: { params: Promise<{ playerId: string }> }) {
  const [{ playerId }, season] = await Promise.all([params, getCurrentSeason()]);
  if (!season) return new Response("Ikke funnet", { status: 404 });
  return playerImageResponse(season.id, playerId);
}

export const Route = createFileRoute("/api/status/bilde/$playerId")({ server: { handlers: { GET: ({ request, params }) => GET(request, { params: Promise.resolve(params) }) } } });
