import "@tanstack/react-start/server-only";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";

// The login route stores this cookie and the callback route reads it back after Photon redirects.
const OAUTH_COOKIE = "mv_oauth";

type OAuthState = { state: string; verifier: string; next: string };

export const redirectUri = (origin: string) => `${origin}/api/auth/callback`;

export function saveOAuthState(value: OAuthState) {
  setCookie(OAUTH_COOKIE, JSON.stringify(value), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
}

export function readOAuthState(): Partial<OAuthState> {
  try {
    const value: unknown = JSON.parse(getCookie(OAUTH_COOKIE) ?? "{}");
    if (!value || typeof value !== "object") return {};
    return {
      state: "state" in value && typeof value.state === "string" ? value.state : undefined,
      verifier:
        "verifier" in value && typeof value.verifier === "string" ? value.verifier : undefined,
      next: "next" in value && typeof value.next === "string" ? value.next : undefined,
    };
  } catch {
    return {};
  }
}

export function clearOAuthState() {
  deleteCookie(OAUTH_COOKIE, { path: "/" });
}
