import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { defaultSettings } from "../src/db/defaults";
import * as schema from "../src/db/schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL mangler");
if (process.env.NODE_ENV === "production" || process.env.VERCEL) throw new Error("Testdata skal aldri inn i produksjon");
// Seed tømmer hele databasen, så den nektes mot alt annet enn en lokal maskin.
const host = new URL(url).hostname;
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
  throw new Error(`Seed kjøres bare mot en lokal database, ikke ${host}`);
}

const client = postgres(url, { max: 1, onnotice: () => undefined });
const db = drizzle(client, { schema });

const CODENAMES = [
  "Alfa", "Bravo", "Charlie", "Delta", "Ekko", "Foxtrot", "Golf", "Hotell", "India", "Juliett", "Kilo", "Lima",
  "Mike", "November", "Oscar", "Papa", "Quebec", "Romeo", "Sierra", "Tango", "Uniform", "Victor", "Whiskey", "Xray",
];
const STUDIES = ["Dataingeniør", "Digital forretningsutvikling", "Digital infrastruktur og cybersikkerhet", "Digital transformasjon", "Informasjonsbehandling"];

const count = Number(process.env.SEED_PLAYERS ?? 24);

await client`truncate table users, seasons, email_outbox, email_templates, audit_log, job_runs restart identity cascade`;

const staffUsers = [
  { username: "test-kokleder", name: "Test Kokleder" },
  { username: "test-indexleder", name: "Test Indexleder" },
  { username: "test-spillmester", name: "Test Spillmester" },
  { username: "test-arrangor", name: "Test Arrangør" },
  { username: "test-medlem", name: "Test Medlem" },
];
const playerUsers = CODENAMES.slice(0, count).map((code, i) => ({
  username: `test-${code.toLowerCase()}`,
  name: `Deltaker ${code}`,
  studyProgram: STUDIES[i % STUDIES.length]!,
  studyStartYear: 2022 + (i % 4),
}));

// Profilbilder fra pravatar.cc (CC0). Tjenesten har 70 faste bilder, valgt med ?img=1–70.
const PORTRAITS = 70;
const portrait = (i: number) => `https://i.pravatar.cc/400?img=${(i % PORTRAITS) + 1}`;

const users = await db
  .insert(schema.users)
  .values([...staffUsers, ...playerUsers].map((u, i) => ({ ...u, email: `${u.username}@example.test`, photonImage: portrait(i) })))
  .returning();

const [season] = await db
  .insert(schema.seasons)
  .values({ name: "Testsesong", phase: "signup", signupDeadline: new Date(Date.now() + 7 * 86400_000), settings: defaultSettings() })
  .returning();
if (!season) throw new Error("Ingen sesong");

await db.insert(schema.staff).values([
  { seasonId: season.id, username: "test-kokleder", role: "gamemaster" },
  { seasonId: season.id, username: "test-spillmester", role: "gamemaster" },
  { seasonId: season.id, username: "test-arrangor", role: "organizer" },
]);

const signed = users.filter((u) => u.username !== "test-medlem" && !staffUsers.some((s) => s.username === u.username)).slice(0, Math.max(0, count - 1));
await db.insert(schema.players).values(
  signed.map((u) => ({
    seasonId: season.id,
    userId: u.id,
    name: u.name,
    studyProgram: u.studyProgram,
    studyStartYear: u.studyStartYear,
    consentAt: new Date(),
  })),
);

console.log(`Testdata: ${users.length} brukere, ${signed.length} påmeldte. Én testdeltaker (${playerUsers.at(-1)?.username}) er ikke påmeldt ennå.`);
await client.end();
