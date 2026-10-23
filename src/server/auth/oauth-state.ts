import "server-only";
import type { NextRequest, NextResponse } from "next/server";

// The login route stores this cookie and the callback route reads it back after Photon redirects.
const OAUTH_COOKIE = "mv_oauth";

type OAuthState = { state: string; verifier: string; next: string };

export const callbackUrl = (origin: string) => `${origin}/api/auth/callback`;

export function saveOAuthState(response: NextResponse, value: OAuthState) {
  response.cookies.set(OAUTH_COOKIE, JSON.stringify(value), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
}

export function readOAuthState(request: NextRequest): Partial<OAuthState> {
  try {
    return JSON.parse(request.cookies.get(OAUTH_COOKIE)?.value ?? "{}") as Partial<OAuthState>;
  } catch {
    return {};
  }
}

export function clearOAuthState(response: NextResponse) {
  response.cookies.delete(OAUTH_COOKIE);
}
