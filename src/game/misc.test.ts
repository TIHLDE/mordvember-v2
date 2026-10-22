import { describe, expect, it } from "vitest";
import { crossedMilestones, DEFAULT_MILESTONES } from "./milestones";
import { qrCode, QR_WINDOW_MS, verifyQrCode } from "./qr";

describe("milepæler", () => {
  const none = new Set<string>();

  it("halvveis av 40", () => {
    expect(crossedMilestones(DEFAULT_MILESTONES, 21, 20, 40, none).map((m) => m.key)).toEqual(["halv"]);
    expect(crossedMilestones(DEFAULT_MILESTONES, 22, 21, 40, none)).toEqual([]);
  });

  it("fyrer ikke to ganger", () => {
    expect(crossedMilestones(DEFAULT_MILESTONES, 21, 20, 40, new Set(["halv"]))).toEqual([]);
  });

  it("tre og vinner", () => {
    expect(crossedMilestones(DEFAULT_MILESTONES, 4, 3, 40, none).map((m) => m.key)).toEqual(["tre"]);
    expect(crossedMilestones(DEFAULT_MILESTONES, 2, 1, 40, none).map((m) => m.key)).toEqual(["vinner"]);
  });

  it("flere grenser i ett hopp ved diskvalifisering av mange", () => {
    expect(crossedMilestones(DEFAULT_MILESTONES, 12, 3, 12, none).map((m) => m.key)).toEqual([
      "halv",
      "kvart",
      "ti",
      "tre",
    ]);
  });
});

describe("QR-kode", () => {
  const secret = "test-hemmelighet";
  const now = 1_800_000_000_000;

  it("gjelder i eget vindu pluss slingring", () => {
    const code = qrCode(secret, "s1", now);
    expect(verifyQrCode(secret, "s1", code, now)).toBe(true);
    expect(verifyQrCode(secret, "s1", code, now + QR_WINDOW_MS)).toBe(true);
    expect(verifyQrCode(secret, "s1", code, now + QR_WINDOW_MS * 3)).toBe(false);
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
