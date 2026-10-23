import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/redirect";
import { redirectUri, saveOAuthState } from "@/server/auth/oauth-state";
import { authorizeUrl, challengeFor, createVerifier } from "@/server/auth/photon";
import { env } from "@/server/env";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!env.photonClientId) return NextResponse.json({ error: "PHOTON_CLIENT_ID er ikke satt" }, { status: 500 });
  const state = crypto.randomUUID();
  const verifier = createVerifier();
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const response = NextResponse.redirect(authorizeUrl(redirectUri(request.nextUrl.origin), state, await challengeFor(verifier)));
  saveOAuthState(response, { state, verifier, next });
  return response;
}
