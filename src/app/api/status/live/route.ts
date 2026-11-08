import { createFileRoute } from "@tanstack/react-router";
import { msUntilNextCode } from "@/game/qr";
import { boardQrSvg } from "@/server/attendance";
import { getCurrentSeason } from "@/server/season";

// Public: the check-in QR code. Check-in itself is limited to Gløshaugen by position.
 async function GET() {
  const season = await getCurrentSeason();
  // One timestamp for both, so the countdown always belongs to the code it is sent with.
  const now = Date.now();
  const qrSvg = season?.phase === "running" ? await boardQrSvg(season.id, now) : null;
  // Relative, so the board does not depend on its own clock agreeing with the server's.
  const nextCodeInMs = msUntilNextCode(now);
  return Response.json({ qrSvg, nextCodeInMs }, { headers: { "Cache-Control": "no-store" } });
}

export const Route = createFileRoute("/api/status/live")({ server: { handlers: { GET: () => GET() } } });
