import { createFileRoute } from "@tanstack/react-router";
import { boardData } from "@/server/board";
import { getCurrentSeason } from "@/server/season";

// Public: never sends check-ins. The QR code comes from `live`.
 async function GET() {
  const season = await getCurrentSeason();
  if (!season) return Response.json({ error: "Ingen sesong er i gang" }, { status: 404 });
  return Response.json(await boardData(season), { headers: { "Cache-Control": "no-store" } });
}

export const Route = createFileRoute("/api/status")({ server: { handlers: { GET: ({ request, params }) => GET(request) } } });
