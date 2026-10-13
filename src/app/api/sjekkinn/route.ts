import { NextResponse, type NextRequest } from "next/server";
import { PENDING_SCAN_COOKIE, PENDING_SCAN_MS, pendingScanValue, verifyScan } from "@/server/attendance";
import { env } from "@/server/env";
import { getCurrentSeason } from "@/server/season";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("k") ?? "";
  const season = await getCurrentSeason();
  if (!season || season.phase !== "running" || !verifyScan(season.id, code)) {
    return NextResponse.redirect(`${env.appUrl}/sjekkinn?feil=kode`);
  }
  const response = NextResponse.redirect(`${env.appUrl}/sjekkinn`);
  response.cookies.set(PENDING_SCAN_COOKIE, pendingScanValue(season.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PENDING_SCAN_MS / 1000,
  });
  return response;
}
