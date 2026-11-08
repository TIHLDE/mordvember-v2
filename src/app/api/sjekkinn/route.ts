import { setCookie } from "@tanstack/react-start/server";
import { createFileRoute } from "@tanstack/react-router";

import { PENDING_SCAN_COOKIE, PENDING_SCAN_MS, pendingScanValue, verifyScan } from "@/server/attendance";
import { getCurrentSeason } from "@/server/season";

 async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("k") ?? "";
  const season = await getCurrentSeason();
  if (!season || season.phase !== "running" || !verifyScan(season.id, code)) {
    return Response.redirect(`${new URL(request.url).origin}/sjekkinn?feil=kode`, 307);
  }
  const response = Response.redirect(`${new URL(request.url).origin}/sjekkinn`, 307);
  setCookie(PENDING_SCAN_COOKIE, pendingScanValue(season.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PENDING_SCAN_MS / 1000,
  });
  return response;
}

export const Route = createFileRoute("/api/sjekkinn")({ server: { handlers: { GET: ({ request, params }) => GET(request) } } });
