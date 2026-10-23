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
});
