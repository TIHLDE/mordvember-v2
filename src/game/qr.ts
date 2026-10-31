import { createHmac, timingSafeEqual } from "node:crypto";

export const QR_WINDOW_MS = 60 * 60 * 1000;
const QR_GRACE_MS = 60_000;

function windowOf(at: number): number {
  return Math.floor(at / QR_WINDOW_MS);
}

/** Milliseconds until the code shown at `at` is replaced by the next one. */
export function msUntilNextCode(at: number): number {
  return (windowOf(at) + 1) * QR_WINDOW_MS - at;
}

function signature(secret: string, seasonId: string, window: number): string {
  return createHmac("sha256", secret).update(`qr:${seasonId}:${window}`).digest("base64url").slice(0, 22);
}

export function qrCode(secret: string, seasonId: string, at: number): string {
  const window = windowOf(at);
  return `${window}.${signature(secret, seasonId, window)}`;
}

export function verifyQrCode(secret: string, seasonId: string, code: string, at: number): boolean {
  const parts = code.split(".");
  if (parts.length !== 2) return false;
  const [windowText, sig] = parts as [string, string];
  if (!windowText || !sig || !/^\d+$/.test(windowText)) return false;
  const window = Number(windowText);
  const start = window * QR_WINDOW_MS;
  const end = start + QR_WINDOW_MS;
  if (at < start - QR_GRACE_MS || at > end + QR_GRACE_MS) return false;
  const expected = Buffer.from(signature(secret, seasonId, window));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
