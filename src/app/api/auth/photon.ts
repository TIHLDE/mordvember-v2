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

type PhotonSession = {
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
};

/**
 * Bruker og grupper, hentet fra Photon ved hvert kall.
 *
 * Den forrige utgaven mellomlagret brukeren i et Map i minnet. Det overlever
 * verken en restart eller en ny serverless-instans, så halvparten av
 * forespørslene traff uansett API-et — og de som traff cachen kunne vise
 * gamle roller etter at noen mistet et verv.
 */
export async function fetchUser(token: string): Promise<AppUser | null> {
  const [sessionResponse, groups] = await Promise.all([
    fetch(`${ISSUER}/get-session`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }),
    fetchGroups(token),
  ]);

  if (!sessionResponse.ok) return null;

  const session = (await sessionResponse.json()) as PhotonSession | null;
  const user = session?.user;
  if (!user) return null;

  // Photon returnerer ett visningsnavn. Å dele det i fornavn og etternavn
  // gjetter feil på alle med to fornavn, så resten legges i etternavnet.
  const [firstName, ...rest] = (user.name ?? "").trim().split(/\s+/);

  return {
    id: user.id,
    firstName: firstName ?? "",
    lastName: rest.join(" "),
    email: user.email ?? "",
    image: user.image ?? null,
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
