import "server-only";
import { env } from "../env";

const KOK_GROUP_SLUG = "kok";
const INDEX_GROUP_SLUG = "index";

export type PhotonGroup = { slug: string; name: string; membership: { role: "member" | "leader" } | null };

export type PhotonIdentity = {
  username: string;
  name: string;
  email: string | null;
  image: string | null;
  studyProgram: string | null;
  studyStartYear: number | null;
  classYear: number | null;
  isKokLeader: boolean;
  isIndexLeader: boolean;
};

export function createVerifier(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

export function authorizeUrl(redirectUri: string, state: string, challenge: string): string {
  const url = new URL(`${env.photonIssuer}/oauth2/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", env.photonClientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export async function exchangeCode(code: string, redirectUri: string, verifier: string): Promise<string> {
  const response = await fetch(`${env.photonIssuer}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: env.photonClientId,
      client_secret: env.photonClientSecret,
      code_verifier: verifier,
      // Uten resource gir Photon et ugjennomsiktig token som API-et avviser med 401.
      resource: env.photonIssuer,
    }).toString(),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Tokenveksling feilet (${response.status})`);
  const tokens = (await response.json()) as { access_token: string };
  return tokens.access_token;
}

async function photonGet<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Photon ${url} svarte ${response.status}: ${detail.slice(0, 200)}`);
  }
  return (await response.json()) as T;
}

export async function downloadPhotonImage(url: string, token: string): Promise<File | null> {
  // Tokenet skal aldri sendes til andre verter enn Photon, så andre URL-er kopieres ikke.
  if (!url.startsWith(`${env.photonApi}/assets/`)) return null;
  const asset = new URL(url);
  asset.searchParams.set("w", "480");
  const response = await fetch(asset, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Photon-bildet svarte ${response.status}`);
  const blob = await response.blob();
  return new File([blob], "photon", { type: blob.type });
}

type UserInfo = { sub: string; name?: string | null; email?: string | null; picture?: string | null; preferred_username?: string | null };

type UserProfile = {
  image: string | null;
  studyProgram: string | null;
  studyStartYear: number | null;
  classYear: number | null;
};

export async function fetchIdentity(token: string): Promise<PhotonIdentity> {
  // userinfo leser bearer-tokenet; get-session leser bare cookien og svarer tomt.
  const [info, groups] = await Promise.all([
    photonGet<UserInfo>(`${env.photonIssuer}/oauth2/userinfo`, token),
    photonGet<PhotonGroup[]>(`${env.photonApi}/groups/mine`, token),
  ]);
  const username = info.preferred_username;
  if (!username) throw new Error("Photon-brukeren mangler brukernavn");
  const profile = await photonGet<UserProfile>(`${env.photonApi}/user/${encodeURIComponent(username)}`, token).catch(
    (error) => {
      console.error("Kunne ikke hente studie og kull fra Photon", error);
      return null;
    },
  );
  const isLeaderOf = (slug: string) =>
    groups.some((g) => g.slug.toLowerCase() === slug && g.membership?.role === "leader");
  return {
    username,
    name: (info.name ?? username).trim(),
    email: info.email ?? null,
    image: profile?.image ?? info.picture ?? null,
    studyProgram: profile?.studyProgram ?? null,
    studyStartYear: profile?.studyStartYear ?? null,
    classYear: profile?.classYear ?? null,
    isKokLeader: isLeaderOf(KOK_GROUP_SLUG),
    isIndexLeader: isLeaderOf(INDEX_GROUP_SLUG),
  };
}
