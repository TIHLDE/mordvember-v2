import { type APIRequestContext, type Browser, chromium } from "playwright";
import postgres from "postgres";
import { devLogin, type LeaderFlags } from "./dev-login";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => undefined });

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`LEKKASJE ELLER FEIL: ${message}`);
}

const PAGES = [
  "/",
  "/pamelding",
  "/offer",
  "/drap",
  "/oppmote",
  "/sjekkinn",
  "/profil",
  "/varsler",
  "/sporsmal",
  "/admin",
  "/admin/drap",
  "/admin/fredag",
  "/admin/oppmote",
  "/admin/sporsmal",
  "/admin/deltakere",
  "/admin/sirkel",
  "/admin/sesong",
  "/admin/maler",
  "/admin/roller",
  "/admin/logg",
  "/admin/nodtilgang",
];
const GM_ONLY = ["/admin/sirkel", "/admin/sesong", "/admin/maler", "/admin/logg"];

let browser: Browser;

async function login(username: string, flags: LeaderFlags = {}): Promise<APIRequestContext> {
  const ctx = await browser.newContext();
  await devLogin(await ctx.newPage(), BASE, username, flags);
  return ctx.request;
}

async function gmClick(username: string, path: string, button: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await devLogin(page, BASE, username, { kok: true }, path);
  await page.getByRole("button", { name: button }).click();
  await page.waitForTimeout(1500);
  await ctx.close();
}

async function main() {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
  });
  const [season] = await sql<
    { id: string }[]
  >`select id from seasons order by created_at desc limit 1`;
  assert(season, "kjør seed først");

  await gmClick("test-kokleder", "/admin/sesong", "Steng påmelding");
  await gmClick("test-kokleder", "/admin/sirkel", "Trekk sirkel");
  await gmClick("test-kokleder", "/admin/sirkel", "Start spillet");

  const [circle] = await sql<
    { ring: string[] }[]
  >`select ring from circles where season_id = ${season.id}`;
  assert(circle && circle.ring.length > 3, "sirkel");
  const players = await sql<{ id: string; name: string; username: string }[]>`
    select p.id, p.name, u.username from players p join users u on u.id = p.user_id where p.season_id = ${season.id}`;
  const byId = new Map(players.map((p) => [p.id, p]));
  const ring = circle.ring.map((id) => byId.get(id)!);

  const victim = ring[1]!;
  const killer = ring[0]!;
  await sql`update kills set status = 'rejected' where season_id = ${season.id}`;
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.on("dialog", (d) => void d.accept());
    for (const [user, button, path] of [
      [killer.username, "Meld drap", "/drap"],
      [victim.username, "Bekreft", "/drap"],
    ] as const) {
      await ctx.clearCookies();
      await page.goto(`${BASE}/dev?next=${path}`);
      await page
        .locator("form", { has: page.locator(`input[name=username][value="${user}"]`) })
        .getByRole("button")
        .click();
      await page.waitForURL(`${BASE}${path}`);
      await page.getByRole("button", { name: button }).first().click();
      await page.waitForTimeout(1500);
    }
    await ctx.close();
  }
  const [after] = await sql<
    { ring: string[] }[]
  >`select ring from circles where season_id = ${season.id}`;
  assert(after && !after.ring.includes(victim.id), "testdrapet ble ikke gjennomført");
  const live = after.ring.map((id) => byId.get(id)!);
  const liveTarget = (p: { id: string }) =>
    live[(live.findIndex((q) => q.id === p.id) + 1) % live.length]!;

  const alive = live[2]!;
  const roles: {
    label: string;
    request: APIRequestContext;
    player: (typeof players)[number] | null;
  }[] = [
    { label: "deltaker", request: await login(alive.username), player: alive },
    { label: "eliminert", request: await login(victim.username), player: victim },
    { label: "medlem", request: await login("test-medlem"), player: null },
    {
      label: "Index-leder uten nødtilgang",
      request: await login("test-indexleder", { index: true }),
      player: null,
    },
    { label: "ikke innlogget", request: (await browser.newContext()).request, player: null },
  ];

  let checked = 0;
  for (const role of roles) {
    for (const path of PAGES) {
      const res = await role.request.get(`${BASE}${path}`, { maxRedirects: 5 });
      const body = await res.text();
      const landed = new URL(res.url()).pathname;
      checked++;
      assert(
        !/targetId|ringBefore|ringAfter|"ring"|ring_before|ring_after/.test(body),
        `${role.label} ${path}: sirkelfelt i svaret`,
      );
      assert(!body.includes("→"), `${role.label} ${path}: viser jeger → offer`);
      if (GM_ONLY.includes(path)) {
        assert(
          res.status() === 404 || !res.url().includes(path),
          `${role.label} får åpnet ${path} (${res.status()})`,
        );
      }
      if (role.player && landed !== "/") {
        const mine = live.find((p) => p.id === role.player!.id) ? liveTarget(role.player) : null;
        for (const p of ring) {
          if (p.id === role.player.id) continue;
          const allowedOnKillPage =
            landed === "/drap" && role.player.id === killer.id && p.id === victim.id;
          if (allowedOnKillPage) continue;
          if (mine && p.id === mine.id)
            assert(
              !body.includes(p.name),
              `${role.label} ${path}: viser eget offer uten å trykke på knappen`,
            );
        }
      }
      if (role.label === "eliminert" && landed !== "/") {
        assert(!body.includes(killer.name), `eliminert ${path}: viser hvem som tok hen`);
      }
      if (!role.player && landed !== "/") {
        for (const p of ring) {
          if (body.includes(p.name))
            assert(false, `${role.label} ${path}: viser deltakernavn ${p.name}`);
        }
      }
      if (role.label === "ikke innlogget" && landed !== "/login") {
        for (const p of ring) assert(!body.includes(p.name), `ikke innlogget ${path}: viser navn`);
      }
    }
    const offerPage = await role.request.get(`${BASE}/offer`);
    if (role.player) {
      const target = liveTarget(role.player);
      assert(
        !(await offerPage.text()).includes(target.name),
        `${role.label}: offeret står i HTML før knappen trykkes`,
      );
    }
  }

  const gm = await login("test-kokleder", { kok: true });
  const gmCircle = await (await gm.get(`${BASE}/admin/sirkel`)).text();
  assert(gmCircle.includes("→"), "spillmester ser sirkelen");
  const [{ views } = { views: 0 }] = await sql<
    { views: number }[]
  >`select count(*)::int as views from audit_log where action = 'sirkel.vist'`;
  assert(views >= 3, "visninger av sirkelen logges");

  const anon = roles.at(-1)!.request;
  const board = (await (await anon.get(`${BASE}/api/status`)).json()) as {
    players: Record<string, unknown>[];
  };
  const names = board.players.map((p) => String(p.name));
  assert(
    JSON.stringify(names) === JSON.stringify([...names].sort((a, b) => a.localeCompare(b, "nb"))),
    "statusskjermen sorterer alfabetisk, ikke i sirkelrekkefølge",
  );
  for (const p of board.players)
    assert(
      Object.keys(p).sort().join() === "id,name,out",
      "statusskjermen sender bare id, navn og ute",
    );
  const victimOnBoard = board.players.find((p) => p.id === victim.id);
  assert(victimOnBoard?.out === true, "statusskjermen viser drapet med en gang det er bekreftet");
  const statusLive = (await (await anon.get(`${BASE}/api/status/live`)).json()) as Record<
    string,
    unknown
  >;
  assert(
    Object.keys(statusLive).sort().join() === "nextCodeInMs,qrSvg",
    "statusskjermen sender bare QR-koden og når den byttes, ingen innsjekker",
  );

  console.log(
    `Sjekket ${checked} sider for ${roles.length} roller. Ingen lekkasje av sirkelen funnet.`,
  );
  console.log(
    "Statusskjermen: alfabetisk rekkefølge, bare id/navn/ute, eliminering vises med en gang.",
  );
  await browser.close();
  await sql.end();
}

main().catch(async (e) => {
  console.error(e);
  await browser?.close();
  await sql.end();
  process.exit(1);
});
