import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_PORT ?? 4010);
const ISSUER = `http://localhost:${PORT}/api/auth`;
const CLIENT_ID = "mordvember-test";
const CLIENT_SECRET = "mock-hemmelighet";
const EMAIL_KEY = "mock-epostnokkel";

type MockUser = { username: string; name: string; leaderOf: string[] };
let current: MockUser = { username: "mock-deltaker", name: "Mock Deltaker", leaderOf: [] };
const codes = new Map<string, { challenge: string; redirectUri: string; user: MockUser }>();
const tokens = new Map<string, MockUser>();
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

function bearerUser(req: import("node:http").IncomingMessage) {
  const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
  return tokens.get(token);
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const path = url.pathname;

  if (path === "/__user" && req.method === "POST") {
    current = JSON.parse(await body(req));
    return json(res, 200, { ok: true });
  }
  if (path === "/__state") return json(res, 200, { emails, errors, imageRequests });

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
    codes.set(code, { challenge: p.get("code_challenge")!, redirectUri: p.get("redirect_uri")!, user: current });
    const back = new URL(p.get("redirect_uri")!);
    back.searchParams.set("code", code);
    back.searchParams.set("state", p.get("state")!);
    res.writeHead(302, { Location: back.toString() });
    return res.end();
  }

  if (path === "/api/auth/oauth2/token" && req.method === "POST") {
    const form = new URLSearchParams(await body(req));
    const entry = codes.get(form.get("code") ?? "");
    const verifier = form.get("code_verifier") ?? "";
    const problems = [
      !entry && "ukjent kode",
      form.get("grant_type") !== "authorization_code" && "grant_type",
      form.get("client_id") !== CLIENT_ID && "client_id",
      form.get("client_secret") !== CLIENT_SECRET && "client_secret",
      entry && b64url(createHash("sha256").update(verifier).digest()) !== entry.challenge && "pkce stemmer ikke",
      entry && form.get("redirect_uri") !== entry.redirectUri && "redirect_uri ulik",
      form.get("resource") !== ISSUER && "resource mangler",
    ].filter(Boolean);
    if (problems.length || !entry) {
      errors.push(`token: ${problems.join(", ")}`);
      return json(res, 400, { error: problems });
    }
    codes.delete(form.get("code")!);
    const token = `jwt.${randomUUID()}.sig`;
    tokens.set(token, entry.user);
    return json(res, 200, { access_token: token, token_type: "Bearer", expires_in: 3600 });
  }

  if (path === "/api/auth/oauth2/userinfo") {
    const user = bearerUser(req);
    if (!user) return json(res, 401, {});
    return json(res, 200, { sub: `sub-${user.username}`, name: user.name, email: `${user.username}@example.test`, preferred_username: user.username });
  }

  if (path === "/api/groups/mine") {
    const user = bearerUser(req);
    if (!user) return json(res, 401, {});
    return json(res, 200, [
      { slug: "kok", name: "KoK", membership: { role: user.leaderOf.includes("kok") ? "leader" : "member" } },
      { slug: "index", name: "Index", membership: { role: user.leaderOf.includes("index") ? "leader" : "member" } },
    ]);
  }

  const profile = /^\/api\/user\/([^/]+)$/.exec(path);
  if (profile) {
    const user = bearerUser(req);
    if (!user || decodeURIComponent(profile[1]!) !== user.username) return json(res, 401, {});
    return json(res, 200, { id: "x", username: user.username, name: user.name, image: `http://localhost:${PORT}/api/assets/profil-${user.username}.png`, studyProgram: "Mockstudiet", studyStartYear: 2024, classYear: 3 });
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
