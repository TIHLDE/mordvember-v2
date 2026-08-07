/**
 * Delt oppsett for Photon-innlogging.
 *
 * Lepton skal avvikles, og appen tok tidligere imot brukernavn og passord i
 * sin egen rute for å veksle dem inn i et token. Nå går brukeren til
 * tihlde.org og kommer tilbake med en kode.
 */
export const ISSUER =
  process.env.PHOTON_ISSUER || "https://photon.tihlde.org/api/auth";

export const API_URL = ISSUER.replace(/\/auth$/, "");

export const CLIENT_ID = process.env.PHOTON_CLIENT_ID || "";
export const CLIENT_SECRET = process.env.PHOTON_CLIENT_SECRET || "";

export const ACCESS_TOKEN = "MORDVEMBER-AccessToken";
export const OAUTH_STATE = "MORDVEMBER-OAuthState";

export type PhotonGroup = {
  slug: string;
  name: string;
  membership: { role: "member" | "leader" } | null;
};

export type AppUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  image: string | null;
  groups: { id: string; name: string; isLeader: boolean }[];
};

/**
 * Tilgang krever ledervervet i Index.
 *
 * Sjekken leser rollen på medlemskapet i stedet for et LEADER-felt på
 * medlemskapstypen, som er formen Lepton hadde. En gruppe uten medlemskap
 * hoppes over — ellers ville den kunne gi tilgang ved et uhell.
 */
export function isIndexLeader(groups: PhotonGroup[]): boolean {
  return groups.some(
    (group) =>
      group.slug.toLowerCase() === "index" &&
      group.membership?.role === "leader"
  );
}

export class GroupsLookupError extends Error {
  constructor(public status: number, public detail: string) {
    super(`Kunne ikke hente grupper fra Photon (${status}): ${detail}`);
    this.name = "GroupsLookupError";
  }
}

/**
 * Kaster framfor å returnere tom liste ved feil.
 *
 * En tom liste ble tidligere til «du er ikke leder i Index», uansett om
 * årsaken var et avvist token eller en nede-tjeneste. Meldingen var feil og
 * sendte feilsøkingen i gal retning.
 */
export async function fetchGroups(token: string): Promise<PhotonGroup[]> {
  const response = await fetch(`${API_URL}/groups/mine`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new GroupsLookupError(response.status, detail.slice(0, 200));
  }

  return (await response.json()) as PhotonGroup[];
}

/** Standard OIDC-claims fra /oauth2/userinfo. */
type PhotonUserInfo = {
  sub: string;
  name?: string | null;
  email?: string | null;
  picture?: string | null;
  preferred_username?: string | null;
};

/**
 * Bruker og grupper, hentet fra Photon ved hvert kall.
 *
 * Identiteten hentes fra `/oauth2/userinfo`, ikke `/get-session`.
 * `get-session` leser sesjonscookien og ignorerer Authorization-headeren —
 * den svarer 200 med tom sesjon selv uten innlogging, som her ble til
 * «Sesjonen er utløpt» for en helt gyldig bruker. userinfo er OAuth-veien og
 * er den eneste som faktisk leser bearer-tokenet.
 *
 * Den forrige utgaven mellomlagret dessuten brukeren i et Map i minnet. Det
 * overlever verken en restart eller en ny serverless-instans, og de
 * forespørslene som traff cachen kunne vise gamle roller etter at noen
 * mistet et verv.
 */
export async function fetchUser(token: string): Promise<AppUser | null> {
  const [userinfoResponse, groups] = await Promise.all([
    fetch(`${ISSUER}/oauth2/userinfo`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }),
    fetchGroups(token),
  ]);

  if (!userinfoResponse.ok) return null;

  const user = (await userinfoResponse.json()) as PhotonUserInfo | null;
  if (!user) return null;

  // Photon returnerer ett visningsnavn. Å dele det i fornavn og etternavn
  // gjetter feil på alle med to fornavn, så resten legges i etternavnet.
  const [firstName, ...rest] = (user.name ?? "").trim().split(/\s+/);

  return {
    // `preferred_username` er TIHLDE-brukernavnet; `sub` er Photons interne
    // id som ingenting utenfor Photon kjenner igjen.
    id: user.preferred_username ?? user.sub,
    firstName: firstName ?? "",
    lastName: rest.join(" "),
    email: user.email ?? "",
    image: user.picture ?? null,
    groups: groups.map((group) => ({
      id: group.slug,
      name: group.name,
      isLeader: group.membership?.role === "leader",
    })),
  };
}

/**
 * PKCE. Photon avviser autorisasjon uten det — «pkce is required for this
 * client» — også for konfidensielle klienter som denne, der hemmeligheten
 * ligger trygt på serveren.
 *
 * Verifieren lagres i en httpOnly-cookie sammen med state og sendes først ved
 * kodevekslingen. Utfordringen som går til Photon er en SHA-256 av den, så
 * autorisasjonskoden alene er ubrukelig.
 */
export function createVerifier(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64url(bytes);
}

export async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier)
  );
  return base64url(new Uint8Array(digest));
}

function base64url(bytes: Uint8Array): string {
  // Indeksert løkke framfor for-of: tsconfig her har target under es2015, og
  // iterasjon over Uint8Array krever downlevelIteration.
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] as number);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
