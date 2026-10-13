import QRCode from "qrcode";
import { seasonForScreenToken } from "@/server/admin";
import { boardQr, recentBoardScans } from "@/server/attendance";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const season = await seasonForScreenToken(token);
  if (!season) return Response.json({ error: "Ugyldig lenke" }, { status: 404 });
  if (season.phase !== "running") return Response.json({ qrSvg: null, scans: [] }, { headers: { "Cache-Control": "no-store" } });
  const qr = boardQr(season.id);
  const qrSvg = await QRCode.toString(qr.url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
  const scans = (await recentBoardScans(season.id, new Date(), 12_000)).map((s) => ({
    key: `${s.playerId}-${s.kind}-${s.at.getTime()}`,
    playerId: s.playerId,
    name: s.name,
    kind: s.kind,
  }));
  return Response.json({ qrSvg, scans }, { headers: { "Cache-Control": "no-store" } });
}
