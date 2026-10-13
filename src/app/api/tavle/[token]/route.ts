import { seasonForScreenToken } from "@/server/admin";
import { boardData } from "@/server/board";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const season = await seasonForScreenToken(token);
  if (!season) return Response.json({ error: "Lenken er ugyldig eller trukket tilbake" }, { status: 404 });
  return Response.json(await boardData(season), { headers: { "Cache-Control": "no-store" } });
}
