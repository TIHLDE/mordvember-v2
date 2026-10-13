import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, put } from "@vercel/blob";
import { env, isDevelopment } from "./env";

const LOCAL_DIR = path.join(process.cwd(), ".data", "uploads");
const MAX_BYTES = 5 * 1024 * 1024;

const TYPES: Record<string, { ext: string; magic: (b: Buffer) => boolean }> = {
  "image/jpeg": { ext: "jpg", magic: (b) => b[0] === 0xff && b[1] === 0xd8 },
  "image/png": { ext: "png", magic: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/webp": { ext: "webp", magic: (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" },
};

function storesLocally() {
  if (env.blobConfigured) return false;
  if (!isDevelopment) throw new Error("BLOB_READ_WRITE_TOKEN mangler");
  return true;
}

export async function storeImage(prefix: string, file: File): Promise<string> {
  if (file.size > MAX_BYTES) throw new Error("Bildet er større enn 5 MB");
  const type = TYPES[file.type];
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!type || !type.magic(buffer)) throw new Error("Bildet må være JPG, PNG eller WebP");
  const key = `${prefix}/${crypto.randomUUID()}.${type.ext}`;
  if (storesLocally()) {
    const target = path.join(LOCAL_DIR, key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, buffer);
    return key;
  }
  const result = await put(key, buffer, { access: "private", contentType: file.type, addRandomSuffix: true });
  return result.pathname;
}

export async function readImage(key: string): Promise<{ body: BodyInit; contentType: string } | null> {
  if (storesLocally()) {
    const target = path.join(LOCAL_DIR, key);
    if (!target.startsWith(LOCAL_DIR)) return null;
    try {
      const data = await readFile(target);
      const ext = path.extname(key).slice(1);
      const contentType = Object.entries(TYPES).find(([, t]) => t.ext === ext)?.[0] ?? "application/octet-stream";
      return { body: new Uint8Array(data), contentType };
    } catch {
      return null;
    }
  }
  const result = await get(key, { access: "private" });
  if (!result || result.statusCode !== 200) return null;
  return { body: result.stream, contentType: result.blob.contentType };
}

export async function deleteImages(keys: string[]) {
  if (!keys.length) return;
  if (storesLocally()) {
    await Promise.all(keys.map((k) => rm(path.join(LOCAL_DIR, k), { force: true })));
    return;
  }
  await del(keys);
}

export function placeholderSvg(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="hsl(${hue} 45% 35%)"/><text x="100" y="118" font-family="sans-serif" font-size="72" fill="#fff" text-anchor="middle">${initials.replace(/[<>&"]/g, "")}</text></svg>`;
}
