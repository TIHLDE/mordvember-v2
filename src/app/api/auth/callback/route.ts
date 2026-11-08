import { createFileRoute } from "@tanstack/react-router";

import { safeNext } from "@/lib/redirect";
import { exchangeCode, fetchIdentity, PhotonForbiddenError } from "@/server/auth/photon";
import { onLogin } from "@/server/auth/login";
import { redirectUri, clearOAuthState, readOAuthState } from "@/server/auth/oauth-state";

function fail(origin: string, reason: string) {
  return Response.redirect(`${origin}/login?feil=${reason}`, 307);
}

async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  const state = new URL(request.url).searchParams.get("state");
  const origin = new URL(request.url).origin;
  const stored = readOAuthState();
  if (!code) return fail(origin, "kode");
  if (!state || !stored.state || state !== stored.state || !stored.verifier)
    return fail(origin, "state");

  let identity;
  let tokens;
  try {
    tokens = await exchangeCode(code, redirectUri(origin), stored.verifier);
    identity = await fetchIdentity(tokens.accessToken);
  } catch (error) {
    if (error instanceof PhotonForbiddenError) return fail(origin, "godkjenning");
    console.error("Photon-innlogging feilet", error);
    return fail(origin, "photon");
  }
  try {
    await onLogin(identity, tokens);
  } catch (error) {
    console.error("Kunne ikke lagre innloggingen", error);
    return fail(origin, "lagring");
  }
  const response = Response.redirect(`${origin}${safeNext(stored.next)}`, 307);
  clearOAuthState();
  return response;
}

export const Route = createFileRoute("/api/auth/callback")({
  server: { handlers: { GET: ({ request }) => GET(request) } },
});
