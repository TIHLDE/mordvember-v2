import { describe, expect, it } from "vitest";
import { composeBio, parseBio } from "./bio";

describe("bio", () => {
  it("slår sammen utfylte felt med linjeskift", () => {
    expect(composeBio({ eyes: "Blå", height: " 180 cm ", hair: "", year: "2. klasse" })).toBe(
      "Øyenfarge: Blå\nHøyde: 180 cm\nKlassetrinn: 2. klasse",
    );
  });

  it("tom bio blir null", () => {
    expect(composeBio({ eyes: "  ", hair: "" })).toBeNull();
  });

  it("linjeskift i et felt kan ikke lage nye linjer", () => {
    expect(composeBio({ hair: "Brun\nØyenfarge: grønn" })).toBe("Hårfarge: Brun Øyenfarge: grønn");
  });

  it("felt med faste valg forkaster ukjente verdier", () => {
    expect(composeBio({ study: "Dataingeniør", year: "7. klasse", hair: "Brun" })).toBe("Hårfarge: Brun");
    expect(composeBio({ study: "DigSec", year: "5. klasse" })).toBe("Studie: DigSec\nKlassetrinn: 5. klasse");
  });

  it("leser tilbake det som ble lagret", () => {
    const values = { eyes: "Grønn", height: "170 cm", hair: "Rødt", study: "Data", year: "1. klasse" };
    expect(parseBio(composeBio(values))).toEqual(values);
    expect(parseBio(null)).toEqual({});
  });
});
