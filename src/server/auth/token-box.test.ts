import { beforeAll, describe, expect, it } from "vitest";
import { seal, unseal } from "./token-box";

beforeAll(() => {
  process.env.QR_SECRET = "test-hemmelighet-som-er-lang-nok";
});

describe("token-box", () => {
  it("gir tilbake det som ble forseglet", () => {
    expect(unseal(seal("jwt.abc.sig"))).toBe("jwt.abc.sig");
  });

  it("lagrer aldri tokenet i klartekst", () => {
    expect(seal("jwt.abc.sig")).not.toContain("jwt.abc.sig");
  });

  it("avviser et endret token", () => {
    const [iv, tag, data] = seal("jwt.abc.sig").split(".");
    const flipped = Buffer.from(data!, "base64url");
    flipped[0]! ^= 1;
    expect(unseal([iv, tag, flipped.toString("base64url")].join("."))).toBeNull();
  });

  it("avviser et token forseglet med en annen hemmelighet", () => {
    const sealed = seal("jwt.abc.sig");
    process.env.QR_SECRET = "en-helt-annen-hemmelighet-her";
    expect(unseal(sealed)).toBeNull();
    process.env.QR_SECRET = "test-hemmelighet-som-er-lang-nok";
  });
});
