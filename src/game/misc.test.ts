import { describe, expect, it } from "vitest";
import { crossedMilestones, DEFAULT_MILESTONES } from "./milestones";
import { qrCode, QR_WINDOW_MS, verifyQrCode } from "./qr";
import { isVisiblyOut, REVEAL_MAX_MINUTES, REVEAL_MIN_MINUTES, revealAt } from "./reveal";
import { seeded } from "./random";

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

describe("forsinket visning på tavla", () => {
  it("forsinkelsen er mellom 15 og 60 minutter", () => {
    const rng = seeded(7);
    const base = new Date(0);
    for (let i = 0; i < 500; i++) {
      const minutes = revealAt(base, rng).getTime() / 60000;
      expect(minutes).toBeGreaterThanOrEqual(REVEAL_MIN_MINUTES);
      expect(minutes).toBeLessThanOrEqual(REVEAL_MAX_MINUTES);
    }
  });

  it("levende vises aldri som ute, eliminerte først etter tidspunktet", () => {
    const now = new Date(1000);
    expect(isVisiblyOut({ status: "alive", revealAt: null }, now)).toBe(false);
    expect(isVisiblyOut({ status: "eliminated", revealAt: new Date(2000) }, now)).toBe(false);
    expect(isVisiblyOut({ status: "eliminated", revealAt: new Date(500) }, now)).toBe(true);
    expect(isVisiblyOut({ status: "disqualified", revealAt: null }, now)).toBe(true);
  });
});
