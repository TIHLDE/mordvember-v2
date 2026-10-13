import { NextResponse, type NextRequest } from "next/server";
import { OAUTH_COOKIE, safeNext } from "@/lib/redirect";
import { exchangeCode, fetchIdentity } from "@/server/auth/photon";
import { onLogin } from "@/server/auth/login";
import { env } from "@/server/env";

function fail(reason: string) {
  return NextResponse.redirect(`${env.appUrl}/login?feil=${reason}`);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  let stored: { state?: string; verifier?: string; next?: string } = {};
  try {
    stored = JSON.parse(request.cookies.get(OAUTH_COOKIE)?.value ?? "{}");
  } catch {
    stored = {};
  }
  if (!code) return fail("kode");
  if (!state || !stored.state || state !== stored.state || !stored.verifier) return fail("state");

  let identity;
  try {
    const token = await exchangeCode(code, `${env.appUrl}/api/auth/callback`, stored.verifier);
    identity = await fetchIdentity(token);
  } catch (error) {
    console.error("Photon-innlogging feilet", error);
    return fail("photon");
  }
  await onLogin(identity);
  const response = NextResponse.redirect(`${env.appUrl}${safeNext(stored.next)}`);
  response.cookies.delete(OAUTH_COOKIE);
  return response;
}
