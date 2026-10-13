import { NextResponse, type NextRequest } from "next/server";
import { OAUTH_COOKIE, safeNext } from "@/lib/redirect";
import { authorizeUrl, challengeFor, createVerifier } from "@/server/auth/photon";
import { env } from "@/server/env";

export async function GET(request: NextRequest) {
  if (!env.photonClientId) return NextResponse.json({ error: "PHOTON_CLIENT_ID er ikke satt" }, { status: 500 });
  const state = crypto.randomUUID();
  const verifier = createVerifier();
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const redirectUri = `${request.nextUrl.origin}/api/auth/callback`;
  const response = NextResponse.redirect(authorizeUrl(redirectUri, state, await challengeFor(verifier)));
  response.cookies.set(OAUTH_COOKIE, JSON.stringify({ state, verifier, next }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}
