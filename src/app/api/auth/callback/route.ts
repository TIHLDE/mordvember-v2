import { NextResponse, type NextRequest } from "next/server";
import { OAUTH_COOKIE, safeNext } from "@/lib/redirect";
import { exchangeCode, fetchIdentity } from "@/server/auth/photon";
import { onLogin } from "@/server/auth/login";

export const dynamic = "force-dynamic";

function fail(origin: string, reason: string) {
  return NextResponse.redirect(`${origin}/login?feil=${reason}`);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const origin = request.nextUrl.origin;
  let stored: { state?: string; verifier?: string; next?: string } = {};
  try {
    stored = JSON.parse(request.cookies.get(OAUTH_COOKIE)?.value ?? "{}");
  } catch {
    stored = {};
  }
  if (!code) return fail(origin, "kode");
  if (!state || !stored.state || state !== stored.state || !stored.verifier) return fail(origin, "state");

  let identity;
  try {
    const token = await exchangeCode(code, `${origin}/api/auth/callback`, stored.verifier);
    identity = await fetchIdentity(token);
  } catch (error) {
    console.error("Photon-innlogging feilet", error);
    return fail(origin, "photon");
  }
  try {
    await onLogin(identity);
  } catch (error) {
    console.error("Kunne ikke lagre innloggingen", error);
    return fail(origin, "lagring");
  }
  const response = NextResponse.redirect(`${origin}${safeNext(stored.next)}`);
  response.cookies.delete(OAUTH_COOKIE);
  return response;
}
