import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_PORT ?? 4010);
const ISSUER = `http://localhost:${PORT}/api/auth`;
const CLIENT_ID = "mordvember-test";
const CLIENT_SECRET = "mock-hemmelighet";
const EMAIL_KEY = "mock-epostnokkel";
const TOKEN_TTL = Number(process.env.MOCK_TOKEN_TTL ?? 3600);
const DIRECTORY = [
  { username: "mock-deltaker", name: "Mock Deltaker" },
  { username: "mock-arrangor", name: "Mock Arrangør" },
  { username: "mock-kokleder", name: "Mock KoK-leder" },
  { username: "mock-ordinar", name: "Mock Ordinær" },
];

type MockUser = { username: string; name: string; leaderOf: string[]; pending?: boolean };
let current: MockUser = { username: "mock-deltaker", name: "Mock Deltaker", leaderOf: [] };
const codes = new Map<string, { challenge: string; redirectUri: string; user: MockUser; offline: boolean }>();
const tokens = new Map<string, { user: MockUser; expiresAt: number }>();
const refreshTokens = new Map<string, MockUser>();
const revokedRefreshTokens = new Set<string>();
let refreshCount = 0;
const emails: unknown[] = [];
const errors: string[] = [];

const b64url = (buf: Buffer) => buf.toString("base64url");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const imageRequests: { key: string; width: string | null }[] = [];

function body(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
  });
}

function json(res: import("node:http").ServerResponse, status: number, value: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(value));
}

// Better Auth 1.7 svarer med RFC 6749-feil og håndhever klientens registrerte autentiseringsmetode.
function oauthError(res: import("node:http").ServerResponse, status: number, error: string, description: string) {
  if (status === 401) res.setHeader("WWW-Authenticate", 'Basic realm="oauth"');
  return json(res, status, { error, error_description: description });
}

// Klienten er registrert som client_secret_basic. Hemmelighet i skjemaet gir 400, feil Basic gir 401.
function clientAuthError(req: import("node:http").IncomingMessage, form: URLSearchParams) {
  if (form.has("client_secret")) return { status: 400, description: "client_secret_post er ikke registrert for klienten" };
  const [scheme, value] = (req.headers.authorization ?? "").split(" ");
  if (scheme !== "Basic" || !value) return { status: 401, description: "mangler Basic-autentisering" };
  const decoded = Buffer.from(value, "base64").toString();
  const split = decoded.indexOf(":");
  const id = decodeURIComponent(decoded.slice(0, split));
  const secret = decodeURIComponent(decoded.slice(split + 1));
  if (split < 0 || id !== CLIENT_ID || secret !== CLIENT_SECRET) return { status: 401, description: "feil klient-id eller hemmelighet" };
  if (form.has("client_id") && form.get("client_id") !== id) return { status: 400, description: "client_id i skjemaet stemmer ikke med Basic" };
  return null;
}

function bearerUser(req: import("node:http").IncomingMessage) {
  const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
  const entry = tokens.get(token);
  return entry && entry.expiresAt > Date.now() ? entry.user : undefined;
}

function issue(res: import("node:http").ServerResponse, user: MockUser, offline: boolean) {
  const token = `jwt.${randomUUID()}.sig`;
  tokens.set(token, { user, expiresAt: Date.now() + TOKEN_TTL * 1000 });
  const refresh = offline ? `refresh.${randomUUID()}` : undefined;
  if (refresh) refreshTokens.set(refresh, user);
  return json(res, 200, { access_token: token, token_type: "Bearer", expires_in: TOKEN_TTL, refresh_token: refresh });
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const path = url.pathname;

  if (path === "/__user" && req.method === "POST") {
    current = JSON.parse(await body(req));
    return json(res, 200, { ok: true });
  }
  // Etterligner utlogging fra tihlde.org: tokenene for økten trekkes tilbake.
  if (path === "/__revoke" && req.method === "POST") {
    const { username } = JSON.parse(await body(req)) as { username: string };
    for (const [token, entry] of tokens) if (entry.user.username === username) tokens.delete(token);
    for (const [token, user] of refreshTokens) {
      if (user.username !== username) continue;
      refreshTokens.delete(token);
      revokedRefreshTokens.add(token);
    }
    return json(res, 200, { ok: true });
  }
  if (path === "/__state") return json(res, 200, { emails, errors, imageRequests, refreshCount });

  if (path === "/api/auth/oauth2/authorize") {
    const p = url.searchParams;
    const problems = [
      p.get("response_type") !== "code" && "response_type",
      p.get("client_id") !== CLIENT_ID && "client_id",
      p.get("code_challenge_method") !== "S256" && "pkce-metode",
      !p.get("code_challenge") && "pkce mangler",
      !p.get("state") && "state",
      !p.get("redirect_uri")?.endsWith("/api/auth/callback") && "redirect_uri",
      !p.get("scope")?.includes("openid") && "scope",
    ].filter(Boolean);
    if (problems.length) {
      errors.push(`authorize: ${problems.join(", ")}`);
      return json(res, 400, { error: problems });
    }
    const code = randomUUID();
    codes.set(code, { challenge: p.get("code_challenge")!, redirectUri: p.get("redirect_uri")!, user: current, offline: p.get("scope")!.split(" ").includes("offline_access") });
    const back = new URL(p.get("redirect_uri")!);
    back.searchParams.set("code", code);
    back.searchParams.set("state", p.get("state")!);
    res.writeHead(302, { Location: back.toString() });
    return res.end();
  }

  if (path === "/api/auth/oauth2/token" && req.method === "POST") {
    const form = new URLSearchParams(await body(req));
    const clientError = clientAuthError(req, form);
    if (clientError) {
      errors.push(`token: invalid_client (${clientError.description})`);
      return oauthError(res, clientError.status, "invalid_client", clientError.description);
    }
    if (form.get("resource") !== ISSUER) {
      errors.push("token: resource mangler");
      return oauthError(res, 400, "invalid_target", "resource er ikke registrert");
    }
    if (form.get("grant_type") === "refresh_token") {
      const user = refreshTokens.get(form.get("refresh_token") ?? "");
      if (!user) {
        // Et tilbakekalt token er et gyldig avslag, ikke en feil i klienten.
        if (!revokedRefreshTokens.has(form.get("refresh_token") ?? "")) errors.push("refresh: ugyldig");
        return oauthError(res, 400, "invalid_grant", "ukjent eller tilbakekalt refresh-token");
      }
      refreshTokens.delete(form.get("refresh_token")!);
      refreshCount++;
      return issue(res, user, true);
    }
    const entry = codes.get(form.get("code") ?? "");
    const verifier = form.get("code_verifier") ?? "";
    const problems = [
      !entry && "ukjent kode",
      form.get("grant_type") !== "authorization_code" && "grant_type",
      entry && b64url(createHash("sha256").update(verifier).digest()) !== entry.challenge && "pkce stemmer ikke",
      entry && form.get("redirect_uri") !== entry.redirectUri && "redirect_uri ulik",
    ].filter(Boolean);
    if (problems.length || !entry) {
      errors.push(`token: ${problems.join(", ")}`);
      return oauthError(res, 400, "invalid_grant", problems.join(", "));
    }
    codes.delete(form.get("code")!);
    return issue(res, entry.user, entry.offline);
  }

  if (path === "/api/auth/oauth2/userinfo") {
    const user = bearerUser(req);
    if (!user) return oauthError(res, 401, "invalid_token", "tokenet er ugyldig eller tilbakekalt");
    return json(res, 200, { sub: `sub-${user.username}`, name: user.name, email: `${user.username}@example.test`, preferred_username: user.username });
  }

  if (path === "/api/groups/mine") {
    const user = bearerUser(req);
    if (!user) return json(res, 401, {});
    if (user.pending) return json(res, 403, {});
    return json(res, 200, [
      { slug: "kok", name: "KoK", membership: { role: user.leaderOf.includes("kok") ? "leader" : "member" } },
      { slug: "index", name: "Index", membership: { role: user.leaderOf.includes("index") ? "leader" : "member" } },
    ]);
  }

  if (path === "/api/user/search") {
    const user = bearerUser(req);
    if (!user) return json(res, 401, {});
    const group = url.searchParams.get("groupSlug");
    if (!group || !user.leaderOf.includes(group)) return json(res, 403, {});
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    return json(res, 200, DIRECTORY.filter((u) => u.username.includes(q) || u.name.toLowerCase().includes(q)).map((u) => ({ id: u.username, ...u, image: null })));
  }

  const profile = /^\/api\/user\/([^/]+)$/.exec(path);
  if (profile) {
    const user = bearerUser(req);
    if (!user || decodeURIComponent(profile[1]!) !== user.username) return json(res, 401, {});
    return json(res, 200, { id: "x", username: user.username, name: user.name, image: `http://localhost:${PORT}/api/assets/profil-${user.username}.png`, studyProgram: "Dataingeniør", studyStartYear: 2024, classYear: 3 });
  }

  const asset = /^\/api\/assets\/(.+)$/.exec(path);
  if (asset) {
    if (!bearerUser(req)) return json(res, 404, {});
    imageRequests.push({ key: asset[1]!, width: url.searchParams.get("w") });
    res.writeHead(200, { "Content-Type": "image/png" });
    return res.end(PNG);
  }

  if (path === "/api/email/send" && req.method === "POST") {
    if (req.headers.authorization !== `Bearer ${EMAIL_KEY}`) {
      errors.push("email: feil nøkkel");
      return json(res, 403, {});
    }
    const mail = JSON.parse(await body(req)) as { to?: unknown; subject?: unknown; content?: { type: string }[]; from?: string };
    const valid =
      typeof mail.to === "string" &&
      typeof mail.subject === "string" &&
      Array.isArray(mail.content) &&
      mail.content.length > 0 &&
      mail.content.every((c) => ["title", "text", "button"].includes(c.type));
    if (!valid) {
      errors.push(`email: ugyldig skjema ${JSON.stringify(mail)}`);
      return json(res, 400, {});
    }
    emails.push(mail);
    return json(res, 200, { success: true, message: "ok", recipientCount: 1 });
  }

  json(res, 404, { path });
}).listen(PORT, () => console.log(`Photon-etterligning på ${ISSUER}`));
