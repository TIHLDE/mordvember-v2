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

export async function fetchGroups(token: string): Promise<PhotonGroup[]> {
  const response = await fetch(`${API_URL}/groups/mine`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) return [];
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
