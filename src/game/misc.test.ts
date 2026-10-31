import { describe, expect, it } from "vitest";
import { msUntilNextCode, qrCode, QR_WINDOW_MS, verifyQrCode } from "./qr";

describe("QR-kode", () => {
  const secret = "test-hemmelighet";
  const now = 1_800_000_000_000;

  it("gjelder i eget vindu pluss slingring", () => {
    const code = qrCode(secret, "s1", now);
    expect(verifyQrCode(secret, "s1", code, now)).toBe(true);
    expect(verifyQrCode(secret, "s1", code, now + QR_WINDOW_MS)).toBe(true);
    expect(verifyQrCode(secret, "s1", code, now + QR_WINDOW_MS * 3)).toBe(false);
  });

  it("vet når neste kode starter", () => {
    const start = Math.ceil(now / QR_WINDOW_MS) * QR_WINDOW_MS;
    expect(msUntilNextCode(start)).toBe(QR_WINDOW_MS);
    expect(msUntilNextCode(start + QR_WINDOW_MS - 1)).toBe(1);
    expect(qrCode(secret, "s1", start + 5 + msUntilNextCode(start + 5))).not.toBe(qrCode(secret, "s1", start + 5));
  });

  it("avviser feil sesong, feil hemmelighet og tukling", () => {
    const code = qrCode(secret, "s1", now);
    expect(verifyQrCode(secret, "s2", code, now)).toBe(false);
    expect(verifyQrCode("annen", "s1", code, now)).toBe(false);
    const [w, sig] = code.split(".");
    expect(verifyQrCode(secret, "s1", `${Number(w) + 1}.${sig}`, now + QR_WINDOW_MS)).toBe(false);
    expect(verifyQrCode(secret, "s1", "tull", now)).toBe(false);
  });

  it("avviser feil signatur", () => {
    const [w, sig] = qrCode(secret, "s1", now).split(".") as [string, string];
    const wrong = sig.replace(/^./, (c) => (c === "A" ? "B" : "A"));
    expect(verifyQrCode(secret, "s1", `${w}.${wrong}`, now)).toBe(false);
  });

  it("avviser kode med ekstra deler", () => {
    const code = qrCode(secret, "s1", now);
    expect(verifyQrCode(secret, "s1", `${code}.ekstra`, now)).toBe(false);
    expect(verifyQrCode(secret, "s1", `${code}.`, now)).toBe(false);
  });

  it("godtar URL-kodet kode fra /api/sjekkinn?k=", () => {
    const code = qrCode(secret, "s1", now);
    const read = (k: string) => new URL(`https://example.com/api/sjekkinn?k=${k}`).searchParams.get("k") ?? "";
    expect(verifyQrCode(secret, "s1", read(encodeURIComponent(code)), now)).toBe(true);
    expect(verifyQrCode(secret, "s1", read(code.replace(".", "%2E")), now)).toBe(true);
    expect(verifyQrCode(secret, "s1", read(encodeURIComponent(`${code}.ekstra`)), now)).toBe(false);
  });
});
