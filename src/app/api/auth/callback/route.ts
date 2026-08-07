import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_TOKEN,
  CLIENT_ID,
  CLIENT_SECRET,
  fetchGroups,
  ISSUER,
  isIndexLeader,
  OAUTH_STATE,
} from "../photon";

export const dynamic = "force-dynamic";

function deny(request: NextRequest, reason: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", reason);
  return NextResponse.redirect(url);
}

/**
 * Tar imot koden fra Photon, veksler den mot et token, og slipper brukeren inn
 * bare hvis vedkommende er leder i Index.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const stored = request.cookies.get(OAUTH_STATE)?.value;
  const [expectedState, verifier] = (stored ?? "").split("|");

  if (!code) return deny(request, "missing_code");

  // Sammenlignes før koden brukes: en callback uten matchende state kommer
  // ikke fra flyten denne nettleseren startet.
  if (!state || !expectedState || state !== expectedState) {
    return deny(request, "invalid_state");
  }

  const redirectUri = new URL("/api/auth/callback", request.url).toString();

  const tokenResponse = await fetch(`${ISSUER}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code_verifier: verifier ?? "",
    }).toString(),
  });

  if (!tokenResponse.ok) return deny(request, "token_exchange_failed");

  const tokens = (await tokenResponse.json()) as {
    access_token: string;
    expires_in?: number;
  };

  let groups;
  try {
    groups = await fetchGroups(tokens.access_token);
  } catch (e) {
    // Skilles fra «ikke leder»: et avvist token eller en nede-tjeneste er en
    // helt annen feil, og å vise dem som samme melding gjør feilsøking umulig.
    console.error("Photon-gruppeoppslag feilet", e);
    return deny(request, "groups_lookup_failed");
  }

  if (!isIndexLeader(groups)) {
    return deny(request, "not_index_leader");
  }

  const response = NextResponse.redirect(new URL("/admin", request.url));
  response.cookies.set(ACCESS_TOKEN, tokens.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: tokens.expires_in ?? 3600,
  });
  response.cookies.delete(OAUTH_STATE);

  return response;
}
