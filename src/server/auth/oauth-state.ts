import "server-only";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";

// The login route stores this cookie and the callback route reads it back after Photon redirects.
const OAUTH_COOKIE = "mv_oauth";

type OAuthState = { state: string; verifier: string; next: string };

export const redirectUri = (origin: string) => `${origin}/api/auth/callback`;

export function saveOAuthState(_response: Response, value: OAuthState) {
  setCookie(OAUTH_COOKIE, JSON.stringify(value), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
}

export function readOAuthState(_request: Request): Partial<OAuthState> {
  try {
    return JSON.parse(getCookie(OAUTH_COOKIE) ?? "{}") as Partial<OAuthState>;
  } catch {
    return {};
  }
}

export function clearOAuthState(_response: Response) {
  deleteCookie(OAUTH_COOKIE, { path: "/" });
}
