import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/redirect";
import { exchangeCode, fetchIdentity } from "@/server/auth/photon";
import { onLogin } from "@/server/auth/login";
import { callbackUrl, clearOAuthState, readOAuthState } from "@/server/auth/oauth-state";

export const dynamic = "force-dynamic";

function fail(origin: string, reason: string) {
  return NextResponse.redirect(`${origin}/login?feil=${reason}`);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const origin = request.nextUrl.origin;
  const stored = readOAuthState(request);
  if (!code) return fail(origin, "kode");
  if (!state || !stored.state || state !== stored.state || !stored.verifier) return fail(origin, "state");

  let identity;
  let tokens;
  try {
    tokens = await exchangeCode(code, callbackUrl(origin), stored.verifier);
    identity = await fetchIdentity(tokens.accessToken);
  } catch (error) {
    console.error("Photon-innlogging feilet", error);
    return fail(origin, "photon");
  }
  try {
    await onLogin(identity, tokens);
  } catch (error) {
    console.error("Kunne ikke lagre innloggingen", error);
    return fail(origin, "lagring");
  }
  const response = NextResponse.redirect(`${origin}${safeNext(stored.next)}`);
  clearOAuthState(response);
  return response;
}
