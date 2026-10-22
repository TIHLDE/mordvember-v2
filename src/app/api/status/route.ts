import { boardData } from "@/server/board";
import { getCurrentSeason } from "@/server/season";

// Public: the status screen needs no screen link. It gets the same data as the board, but never the QR code or check-ins.
export async function GET() {
  const season = await getCurrentSeason();
  if (!season) return Response.json({ error: "Ingen sesong er i gang" }, { status: 404 });
  return Response.json(await boardData(season), { headers: { "Cache-Control": "no-store" } });
}
