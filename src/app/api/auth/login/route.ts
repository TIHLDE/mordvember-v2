import { NextRequest, NextResponse } from "next/server";
import { CLIENT_ID, ISSUER, OAUTH_STATE } from "../photon";

export const dynamic = "force-dynamic";

/**
 * Starter innloggingen: sender brukeren til Photon.
 *
 * Var en POST som tok imot brukernavn og passord. Nå er den en redirect —
 * passordet skrives inn på tihlde.org, aldri her.
 */
export async function GET(request: NextRequest) {
  if (!CLIENT_ID) {
    return NextResponse.json(
      { error: "PHOTON_CLIENT_ID er ikke satt" },
      { status: 500 }
    );
  }

  const redirectUri = new URL("/api/auth/callback", request.url).toString();

  // State binder callbacken til nettleseren som startet flyten. Uten den kan
  // en angriper lokke brukeren gjennom en callback med sin egen kode, og appen
  // ville logget inn som feil person.
  const state = crypto.randomUUID();

  const authorizeUrl = new URL(`${ISSUER}/oauth2/authorize`);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", "openid profile email");
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl.toString());
  response.cookies.set(OAUTH_STATE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return response;
}
