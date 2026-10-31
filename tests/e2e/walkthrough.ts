import { createHmac } from "node:crypto";
import { deflateSync } from "node:zlib";
import { mkdirSync } from "node:fs";
import { type Browser, type BrowserContext, chromium, type Page } from "playwright";
import postgres from "postgres";
import { devLogin, type LeaderFlags } from "./dev-login";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => undefined });
const QR_SECRET = process.env.QR_SECRET!;
const SHOTS = "test-results/walkthrough";
mkdirSync(SHOTS, { recursive: true });

const log = (...args: unknown[]) => console.log("•", ...args);
function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FEIL: ${message}`);
}

let browser: Browser;
const contexts = new Map<string, BrowserContext>();

async function as(username: string, flags: LeaderFlags = {}): Promise<Page> {
  const key = `${username}:${flags.kok ? 1 : 0}${flags.index ? 1 : 0}`;
  let ctx = contexts.get(key);
  if (!ctx) {
    ctx = await browser.newContext({ geolocation: { latitude: 63.416162, longitude: 10.405852 }, permissions: ["geolocation"] });
    const page = await ctx.newPage();
    await devLogin(page, BASE, username, flags);
    contexts.set(key, ctx);
    return page;
  }
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  return page;
}

async function submit(page: Page, scope: ReturnType<Page["locator"]>, button: string | RegExp) {
  const handle = await scope.elementHandle({ timeout: 30000 });
  assert(handle, "fant ikke skjemaet");
  await scope.getByRole("button", { name: button }).click();
  await page.waitForFunction(
    (form) => !form.isConnected || !!form.querySelector("[role=status], [role=alert]"),
    handle,
    { timeout: 30000 },
  );
  const result = await handle.evaluate((form) => {
    const el = form.isConnected ? form.querySelector("[role=status], [role=alert]") : null;
    return el ? { role: el.getAttribute("role"), text: el.textContent ?? "" } : { role: "status", text: "" };
  });
  if (result.role === "alert") throw new Error(`Skjema feilet: ${result.text}`);
  return result.text;
}

function formWith(page: Page, text: string | RegExp) {
  return page.locator("form").filter({ hasText: text }).first();
}

function png(): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, c]);
  };
  const size = 64;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) raw.set([x * 4, y * 4, 128], y * (size * 3 + 1) + 1 + x * 3);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const usernameOf = (name: string) => `test-${name.replace("Deltaker ", "").toLowerCase()}`;

async function alivePlayers(seasonId: string) {
  return sql<{ id: string; name: string }[]>`select id, name from players where season_id = ${seasonId} and status = 'alive' order by name`;
}

async function revealTarget(page: Page): Promise<string> {
  await page.goto(`${BASE}/offer`);
  await page.getByRole("button", { name: "Vis offer" }).click();
  const nameEl = page.locator("p.text-2xl");
  await page.waitForFunction(() => (document.querySelector("p.text-2xl")?.textContent ?? "").length > 0, null, { timeout: 15000 });
  const name = (await nameEl.textContent())!.trim();
  await page.getByRole("button", { name: "Skjul" }).click();
  await page.waitForFunction(() => (document.querySelector("p.text-2xl")?.textContent ?? "") === "");
  return name;
}

// Only the killer reports a kill. The victim sees who reported it, and confirms or disputes.
async function reportAndConfirm(killerName: string, opts: { dispute?: boolean } = {}) {
  const killer = await as(usernameOf(killerName));
  const targetName = await revealTarget(killer);
  const confirmer = await as(usernameOf(targetName));
  await killer.goto(`${BASE}/drap`);
  await submit(killer, formWith(killer, "Meld drap"), "Meld drap");
  await confirmer.goto(`${BASE}/drap`);
  const banner = await confirmer.locator("text=Et drap du er part i venter på svar fra deg").count();
  assert(banner === 1, "offeret ser ikke varselet øverst");
  const open = confirmer.locator("li").filter({ hasText: `${killerName} har meldt at hen tok deg` }).first();
  if (opts.dispute) {
    await submit(confirmer, open.locator("form").filter({ hasText: "Dette stemmer ikke" }), "Dette stemmer ikke");
  } else {
    await submit(confirmer, open.locator("form").filter({ hasText: "Bekreft" }), "Bekreft");
    const [row] = await sql<{ status: string }[]>`select status from players where name = ${targetName} order by created_at desc limit 1`;
    assert(row?.status === "eliminated", `drapet på ${targetName} ble ikke gjennomført`);
  }
  return targetName;
}

async function main() {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
  const [season] = await sql<{ id: string; name: string }[]>`select id, name from seasons order by created_at desc limit 1`;
  assert(season, "ingen sesong, kjør seed først");

  const anon = await browser.newPage();
  await anon.goto(BASE);
  const anonHtml = await anon.content();
  assert(!anonHtml.includes("Deltaker Alfa"), "ikke innloggede ser navn");
  assert((await anon.request.get(`${BASE}/api/bilde/00000000-0000-0000-0000-000000000000`)).status() === 401, "bilde uten innlogging");
  log("Forsiden viser ingen navn eller bilder uten innlogging");

  const xray = await as("test-xray");
  await xray.goto(`${BASE}/pamelding`);
  await xray.locator("input[type=file]").setInputFiles({ name: "meg.png", mimeType: "image/png", buffer: png() });
  await xray.locator("input[name=consent]").check();
  await xray.getByRole("button", { name: "Meld meg på" }).click();
  await xray.locator("text=Du er påmeldt!").waitFor({ timeout: 30000 });
  log("Påmelding med opplastet bilde fullført");
  await xray.goto(`${BASE}/pamelding`);
  await xray.goto(`${BASE}/`);
  await xray.screenshot({ path: `${SHOTS}/01-pamelding.png`, fullPage: true });

  const member = await as("test-medlem");
  await member.goto(BASE);
  assert((await member.locator("img[alt='Deltaker Alfa']").count()) === 1, "medlemmer ser rutenettet");
  log("Innlogget medlem ser deltakerrutenettet");

  const gm = await as("test-kokleder", { kok: true });
  await gm.goto(`${BASE}/admin/sesong`);
  await submit(gm, formWith(gm, "Steng påmelding"), "Steng påmelding");
  await gm.goto(`${BASE}/admin/sirkel`);
  await submit(gm, formWith(gm, /^Trekk sirkel$/), "Trekk sirkel");
  await gm.goto(`${BASE}/admin/sirkel`);
  await submit(gm, formWith(gm, "Trekk på nytt"), "Trekk på nytt");
  await gm.goto(`${BASE}/admin/sirkel`);
  await submit(gm, formWith(gm, "Start spillet"), "Start spillet");
  log("Sirkel trukket to ganger og spillet startet");

  const board = await browser.newPage();
  await board.setViewportSize({ width: 1600, height: 900 });
  await board.goto(`${BASE}/status`);
  await board.locator("text=Spillere igjen").waitFor({ timeout: 20000 });
  // Nobody is out yet, so the QR code is shown without waiting for the panel to switch.
  await board.locator("text=Skann for å sjekke inn eller ut").waitFor({ timeout: 20000 });
  log("Statusskjermen viser antall og QR-kode");

  const [{ count: firstMails } = { count: -1 }] = await sql<{ count: number }[]>`select count(*)::int as count from email_outbox where subject = 'Mordvember har startet'`;
  assert(firstMails === 24, `e-post om første offer til alle (fikk ${firstMails})`);
  log("E-post om første offer lagt i kø for 24 deltakere");

  const alfa = await as("test-alfa");
  const window = Math.floor(Date.now() / 3_600_000);
  const sig = createHmac("sha256", QR_SECRET).update(`qr:${season.id}:${window}`).digest("base64url").slice(0, 22);
  const scanCtx = await browser.newContext({ geolocation: { latitude: 63.416162, longitude: 10.405852 }, permissions: ["geolocation"] });
  const scanPage = await scanCtx.newPage();
  await scanPage.goto(`${BASE}/api/sjekkinn?k=${window}.${sig}`);
  assert(scanPage.url() === `${BASE}/login?next=%2Fsjekkinn`, `QR uten innlogging sender til innlogging (fikk ${scanPage.url()})`);
  await scanPage.getByRole("link", { name: "velg testbruker" }).click();
  await scanPage.locator("form", { has: scanPage.locator('input[value="test-alfa"]') }).getByRole("button").click();
  await scanPage.waitForURL(`${BASE}/sjekkinn`);
  await scanPage.getByRole("button", { name: "Sjekk inn" }).click();
  await scanPage.locator("text=Du er sjekket inn").waitFor({ timeout: 20000 });
  log("QR-lenke åpnet uten innlogging, innsjekk fullført etter innlogging");
  await scanCtx.close();
  const w2 = Math.floor(Date.now() / 3_600_000);
  const sig2 = createHmac("sha256", QR_SECRET).update(`qr:${season.id}:${w2}`).digest("base64url").slice(0, 22);
  await alfa.goto(`${BASE}/api/sjekkinn?k=${w2}.${sig2}`);
  await alfa.getByRole("button", { name: "Sjekk ut" }).click();
  await alfa.locator("text=Du er sjekket ut").waitFor({ timeout: 20000 });
  await alfa.goto(`${BASE}/api/sjekkinn?k=1.ugyldig`);
  assert((await alfa.locator("text=QR-koden er utløpt eller ugyldig").count()) === 1, "ugyldig QR avvises");
  log("Utsjekk og avvisning av ugyldig kode virker");
  const farCtx = await browser.newContext({ geolocation: { latitude: 63.4305, longitude: 10.3951 }, permissions: ["geolocation"] });
  const farPage = await farCtx.newPage();
  const w3 = Math.floor(Date.now() / 3_600_000);
  const sig3 = createHmac("sha256", QR_SECRET).update(`qr:${season.id}:${w3}`).digest("base64url").slice(0, 22);
  await farPage.goto(`${BASE}/api/sjekkinn?k=${w3}.${sig3}`);
  await farPage.goto(`${BASE}/dev?next=/sjekkinn`);
  await farPage.locator("form", { has: farPage.locator('input[value="test-alfa"]') }).getByRole("button").click();
  await farPage.getByRole("button", { name: "Sjekk inn" }).click();
  await farPage.locator("text=Du må være på Gløshaugen").waitFor({ timeout: 20000 });
  await farCtx.close();
  log("Innsjekk fra Trondheim sentrum avvises");

  const gm2 = await as("test-spillmester");
  let alive = await alivePlayers(season.id);
  const v1 = await reportAndConfirm(alive[0]!.name);
  log(`Drap bekreftet av offeret: ${alive[0]!.name} tok ${v1}`);

  alive = await alivePlayers(season.id);
  const killer2 = alive[1]!.name;
  const v2 = await reportAndConfirm(killer2);
  log(`Drap bekreftet av offeret: ${killer2} tok ${v2}`);

  alive = await alivePlayers(season.id);
  const killer3 = alive[2]!.name;
  const v3 = await reportAndConfirm(killer3, { dispute: true });
  await gm2.goto(`${BASE}/admin/drap`);
  await submit(gm2, gm2.locator("form").filter({ hasText: "Godkjenn drap" }).first(), "Godkjenn drap");
  log(`Bestridt drap godkjent av spillmester: ${killer3} tok ${v3}`);

  await gm.goto(`${BASE}/admin/drap`);
  const undoRow = gm.locator("li").filter({ hasText: `${killer3} → ${v3}` });
  await submit(gm, undoRow.locator("form"), "Angre");
  const [undone] = await sql<{ status: string }[]>`select status from players where name = ${v3} and season_id = ${season.id}`;
  assert(undone?.status === "alive", "angret drap gjenoppliver offeret");
  log(`Spillmester angret drapet på ${v3}`);

  await gm.goto(`${BASE}/admin/sirkel`);
  const mercyForm = formWith(gm, "Gi nåde");
  await mercyForm.locator("select[name=playerId]").selectOption({ label: v1 });
  await submit(gm, mercyForm, "Gi nåde");
  log(`Nåde gitt til ${v1}`);

  // Disqualifying is done from the player's own admin page.
  const disqualify = async (player: { id: string }) => {
    await gm2.goto(`${BASE}/admin/deltakere/${player.id}`);
    const form = formWith(gm2, "Diskvalifiser");
    await form.locator("input[name=reason]").fill("Testdiskvalifisering");
    await submit(gm2, form, "Diskvalifiser");
  };
  alive = await alivePlayers(season.id);
  const dq1 = alive[3]!;
  await disqualify(dq1);
  alive = await alivePlayers(season.id);
  const dq2 = alive.slice(0, 2);
  for (const player of dq2) await disqualify(player);
  log(`Diskvalifisert: ${[dq1, ...dq2].map((p) => p.name).join(", ")}`);

  await gm2.goto(`${BASE}/admin/fredag`);
  await submit(gm2, formWith(gm2, "Lag lista for denne uka nå"), "Lag lista for denne uka nå");
  await gm2.goto(`${BASE}/admin/fredag`);
  const firstReview = gm2.locator("li").filter({ has: gm2.locator("button", { hasText: "Unntak" }) }).first();
  await firstReview.locator("input[name=reason]").fill("Syk denne uka");
  await submit(gm2, firstReview.locator("form"), "Unntak");
  log("Fredagslista laget, ett unntak gitt");

  await alfa.goto(`${BASE}/sporsmal`);
  await alfa.locator("textarea[name=question]").fill("Teller det hvis offeret sover?");
  await submit(alfa, formWith(alfa, "Send"), "Send");
  await gm2.goto(`${BASE}/admin/sporsmal`);
  await gm2.locator("textarea[name=answer]").first().fill("Ja, så lenge ingen ser det.");
  await submit(gm2, gm2.locator("form").filter({ hasText: "Send svar" }).first(), "Send svar");
  await member.goto(`${BASE}/sporsmal`);
  assert((await member.locator("text=Ja, så lenge ingen ser det.").count()) === 1, "svaret er synlig for andre");
  log("Spørsmål stilt og besvart, synlig for alle");

  await gm2.goto(`${BASE}/admin/deltakere`);
  await gm2.locator("a", { hasText: "Deltaker Xray" }).click();
  await gm2.locator("input[name=message]").fill("Ansiktet vises ikke");
  await submit(gm2, gm2.locator("form").filter({ hasText: "Avvis" }), "Avvis");
  log("Bilde avvist av spillmester");

  let round = 0;
  for (;;) {
    alive = await alivePlayers(season.id);
    if (alive.length <= 1) break;
    const killer = alive[round % alive.length]!;
    await reportAndConfirm(killer.name);
    round++;
  }
  log(`Spillet avgjort etter ${round} drap til i løkka`);

  const [winner] = await alivePlayers(season.id);
  assert(winner, "vinner");
  const winnerPage = await as(usernameOf(winner.name));
  await winnerPage.goto(BASE);
  const winnerCard = winnerPage.locator("p", { hasText: /^Vinner$/ }).locator("xpath=..");
  assert((await winnerCard.textContent())?.includes(winner.name), "vinneren vises");
  assert((await winnerPage.getByText("Du vant!").count()) === 1, "vinneren får vite at hen vant");
  await winnerPage.screenshot({ path: `${SHOTS}/03-vinner.png`, fullPage: true });
  await board.goto(`${BASE}/status`);
  await board.locator("text=Vi har en vinner").waitFor({ timeout: 20000 });
  await board.screenshot({ path: `${SHOTS}/04-status-vinner.png` });
  log(`Vinner: ${winner.name}, vist på forsiden og statusskjermen`);


  await gm.goto(`${BASE}/admin/sesong`);
  await submit(gm, formWith(gm, "Stopp spillet"), "Stopp spillet");
  await gm.goto(`${BASE}/admin/sesong`);
  const reset = formWith(gm, "Nullstill spillet");
  await reset.locator("input[name=confirm]").fill(`Nullstill ${season.name}`);
  await submit(gm, reset, "Nullstill spillet");
  const [{ count: left } = { count: -1 }] = await sql<{ count: number }[]>`select count(*)::int as count from players where season_id = ${season.id}`;
  const [after] = await sql<{ phase: string }[]>`select phase from seasons where id = ${season.id}`;
  assert(left === 0, "spilldata slettet");
  assert(after?.phase === "setup", "spillet er tilbake i oppsett");
  log("Spillet stoppet og nullstilt");

  const res = await fetch(`${BASE}/api/cron`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  assert(res.ok, "cron svarer");
  log("Cron kjørt:", await res.text());

  await browser.close();
  await sql.end();
  console.log("\nGjennomkjøringen er fullført uten feil.");
}

main().catch(async (error) => {
  console.error(error);
  for (const [key, ctx] of contexts) {
    const page = ctx.pages()[0];
    if (page) await page.screenshot({ path: `${SHOTS}/feil-${key.replace(/[^\w-]/g, "_")}.png`, fullPage: true }).catch(() => undefined);
  }
  await browser?.close();
  await sql.end();
  process.exit(1);
});
