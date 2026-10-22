import { boardQrSvg } from "@/server/attendance";
import { getCurrentSeason } from "@/server/season";

// Public: the check-in QR code. Check-in itself is limited to Gløshaugen by position.
export async function GET() {
  const season = await getCurrentSeason();
  const qrSvg = season?.phase === "running" ? await boardQrSvg(season.id) : null;
  return Response.json({ qrSvg }, { headers: { "Cache-Control": "no-store" } });
}
