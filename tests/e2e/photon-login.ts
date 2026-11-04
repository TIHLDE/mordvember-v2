import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const MOCK = process.env.MOCK_URL ?? "http://localhost:4010";
const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => undefined });

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FEIL: ${message}`);
}

async function setUser(user: { username: string; name: string; leaderOf: string[]; pending?: boolean }) {
  await fetch(`${MOCK}/__user`, { method: "POST", body: JSON.stringify(user) });
}

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });

  await setUser({ username: "mock-deltaker", name: "Mock Deltaker", leaderOf: [] });
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${BASE}/login?next=/pamelding`);
  await page.getByRole("link", { name: "Logg inn med TIHLDE" }).click();
  await page.waitForURL(`${BASE}/pamelding`);
  assert((await page.locator("select[name=bio_study]").inputValue()) === "Data", "studie fra Photon fylles inn i skjemaet");
  assert((await page.locator("select[name=bio_year]").inputValue()) === "3. klasse", "klassetrinn fra Photon fylles inn i skjemaet");
  console.log("• Innlogging via Photon (PKCE, state, resource) og studie/klassetrinn fra /api/user/:brukernavn");

  const [copied] = await sql<{ key: string | null }[]>`select photon_image_key as key from users where username = 'mock-deltaker'`;
  const { imageRequests } = (await (await fetch(`${MOCK}/__state`)).json()) as { imageRequests: { key: string; width: string | null }[] };
  assert(copied?.key?.startsWith("photon/"), `det private Photon-bildet er kopiert ved innlogging (${JSON.stringify(copied)})`);
  assert(imageRequests.some((r) => r.key === "profil-mock-deltaker.png" && r.width === "480"), "bildet hentes med token i 480 px");
  console.log("• Privat profilbilde hentes med brukerens token og lagres hos oss");

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

  await gm.goto(`${BASE}/admin/roller`);
  const search = gm.getByRole("combobox");
  await search.fill("mock-ordi");
  await gm.getByRole("option", { name: /Mock Ordinær/ }).waitFor();
  console.log("• Brukersøket i Photon bruker det lagrede tokenet");

  await fetch(`${MOCK}/__revoke`, { method: "POST", body: JSON.stringify({ username: "mock-kokleder" }) });
  const relogin = gm.waitForRequest((r) => r.url().startsWith(`${BASE}/api/auth/callback`));
  await search.fill("mock-delt");
  await relogin;
  await gm.waitForURL(`${BASE}/admin/roller`);
  await gm.getByRole("combobox").fill("mock-delt");
  await gm.getByRole("option", { name: /Mock Deltaker/ }).waitFor();
  console.log("• Tilbakekalt token (utlogget fra tihlde.org) sender brukeren gjennom innloggingen og tilbake");

  await setUser({ username: "mock-ventende", name: "Mock Ventende", leaderOf: [], pending: true });
  const pending = await (await browser.newContext()).newPage();
  await pending.goto(`${BASE}/login`);
  await pending.getByRole("link", { name: "Logg inn med TIHLDE" }).click();
  await pending.waitForURL(`${BASE}/login?feil=godkjenning`);
  assert((await pending.getByText("venter på godkjenning").count()) === 1, "konto som venter på godkjenning får egen melding");
  console.log("• Konto som venter på godkjenning i Photon får beskjed om det");

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
