import { createFileRoute } from "@tanstack/react-router";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/redirect";
import { redirectUri, saveOAuthState } from "@/server/auth/oauth-state";
import { authorizeUrl, challengeFor, createVerifier } from "@/server/auth/photon";
import { env } from "@/server/env";

export const dynamic = "force-dynamic";

 async function GET(request: Request) {
  if (!env.photonClientId) return NextResponse.json({ error: "PHOTON_CLIENT_ID er ikke satt" }, { status: 500 });
  const state = crypto.randomUUID();
  const verifier = createVerifier();
  const next = safeNext(new URL(request.url).searchParams.get("next"));
  const response = NextResponse.redirect(authorizeUrl(redirectUri(new URL(request.url).origin), state, await challengeFor(verifier)));
  saveOAuthState(response, { state, verifier, next });
  return response;
}

export const Route = createFileRoute("/api/auth/login")({ server: { handlers: { GET: ({ request, params }) => GET(request) } } });
