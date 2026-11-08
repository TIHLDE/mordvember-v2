import { createFileRoute } from "@tanstack/react-router";
import { getViewer } from "@/server/auth/session";
import { playerImageResponse } from "@/server/player-image";

 async function GET(_: Request, { params }: { params: Promise<{ playerId: string }> }) {
  const viewer = await getViewer();
  if (!viewer?.season) return new Response("Logg inn", { status: 401 });
  const { playerId } = await params;
  return playerImageResponse(viewer.season.id, playerId);
}

export const Route = createFileRoute("/api/bilde/$playerId")({ server: { handlers: { GET: ({ request, params }) => GET(request, { params: Promise.resolve(params) }) } } });
