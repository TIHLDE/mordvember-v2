import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const MOCK = process.env.MOCK_URL ?? "http://localhost:4010";
const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => undefined });

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FEIL: ${message}`);
}

async function setUser(user: { username: string; name: string; leaderOf: string[] }) {
  await fetch(`${MOCK}/__user`, { method: "POST", body: JSON.stringify(user) });
}

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });

  await setUser({ username: "mock-deltaker", name: "Mock Deltaker", leaderOf: [] });
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${BASE}/login?next=/pamelding`);
  await page.getByRole("link", { name: "Logg inn med TIHLDE" }).click();
  await page.waitForURL(`${BASE}/pamelding`);
  assert((await page.locator("text=Mockstudiet").count()) === 1, "studieprogram fra Photon vises");
  assert((await page.locator("text=2024").count()) >= 1, "kull fra Photon vises");
  console.log("• Innlogging via Photon (PKCE, state, resource) og studie/kull fra /api/user/:brukernavn");

  const [copied] = await sql<{ key: string | null }[]>`select photon_image_key as key from users where username = 'mock-deltaker'`;
  const { imageRequests } = (await (await fetch(`${MOCK}/__state`)).json()) as { imageRequests: { key: string; width: string | null }[] };
  assert(copied?.key?.startsWith("photon/"), `det private Photon-bildet er kopiert ved innlogging (${JSON.stringify(copied)})`);
  assert(imageRequests.some((r) => r.key === "profil-mock-deltaker.png" && r.width === "480"), "bildet hentes med token i 480 px");
  console.log("• Privat profilbilde hentes med brukerens token og lagres hos oss");

  await page.getByRole("button", { name: "Dette stemmer ikke" }).click();
  await page.locator("text=Teknologiministeren har fått beskjed").waitFor();
  let mails: { to: string; subject: string; content: { type: string }[] }[] = [];
  for (let i = 0; i < 20 && !mails.length; i++) {
    await new Promise((r) => setTimeout(r, 500));
    mails = ((await (await fetch(`${MOCK}/__state`)).json()) as { emails: typeof mails }).emails;
  }
  assert(mails.length === 1, "e-post sendt til Photon");
  assert(mails[0]!.to === "teknologiminister@tihlde.org", "riktig mottaker");
  assert(mails[0]!.content.some((c) => c.type === "text"), "innhold som blokker");
  console.log("• E-post sendt gjennom Photon-API-et med riktig nøkkel og skjema");

  const [outbox] = await sql<{ status: string; attempts: number }[]>`select status, attempts from email_outbox order by created_at desc limit 1`;
  assert(outbox?.status === "sent" && outbox.attempts === 1, `e-posten er merket sendt én gang (${JSON.stringify(outbox)})`);

  await page.getByRole("button", { name: "Logg ut" }).click();
  await page.waitForURL(`${BASE}/`);
  assert((await page.getByRole("link", { name: "Logg inn" }).count()) >= 1, "logget ut");

  await setUser({ username: "mock-kokleder", name: "Mock Kokleder", leaderOf: ["kok"] });
  const gm = await (await browser.newContext()).newPage();
  await gm.goto(`${BASE}/login?next=/admin`);
  await gm.getByRole("link", { name: "Logg inn med TIHLDE" }).click();
  await gm.waitForURL(`${BASE}/admin`);
  assert((await gm.getByRole("link", { name: "Sirkel" }).count()) === 1, "KoK-leder er spillmester");
  const [staffRow] = await sql<{ username: string }[]>`select username from staff where username = 'mock-kokleder'`;
  assert(staffRow, "KoK-leder lagt til som spillmester ved innlogging");
  console.log("• KoK-leder blir spillmester automatisk");

  const forged = await (await browser.newContext()).newPage();
  await forged.goto(`${BASE}/api/auth/callback?code=tull&state=tull`);
  assert(forged.url().includes("/login?feil=state"), "callback uten matchende state avvises");
  console.log("• Callback uten riktig state avvises");

  const state = (await (await fetch(`${MOCK}/__state`)).json()) as { errors: string[] };
  assert(state.errors.length === 0, `Photon-etterligningen avviste kall: ${state.errors.join("; ")}`);
  await browser.close();
  await sql.end();
  console.log("\nInnlogging og e-post mot Photon-etterligningen virker.");
}

main().catch(async (e) => {
  console.error(e);
  await sql.end();
  process.exit(1);
});
