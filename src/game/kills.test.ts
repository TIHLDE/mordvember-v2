import { describe, expect, it } from "vitest";
import {
  canBeDisqualified,
  checkReport,
  CONFIRM_TIMEOUT_MS,
  decideOnConfirm,
  findCollisions,
  isOverdue,
  type KillCase,
} from "./kills";

const t = (h: number) => new Date(Date.UTC(2026, 10, 2, h));
const start = t(0);
const now = t(23);

function kill(over: Partial<KillCase>): KillCase {
  return {
    id: "k1",
    killerId: "a",
    victimId: "b",
    killedAt: t(10),
    reportedBy: "killer",
    reportedAt: t(10),
    status: "pending",
    ...over,
  };
}

describe("checkReport", () => {
  const ring = ["a", "b", "c"];

  it("morderen kan bare melde sitt eget offer", () => {
    expect(checkReport(ring, "a", "killer", [])).toEqual({ ok: true, killerId: "a", victimId: "b" });
  });

  it("offeret melder, og serveren finner jegeren uten å vise den", () => {
    expect(checkReport(ring, "b", "victim", [])).toEqual({ ok: true, killerId: "a", victimId: "b" });
    expect(checkReport(ring, "a", "victim", [])).toEqual({ ok: true, killerId: "c", victimId: "a" });
  });

  it("nekter deltakere utenfor sirkelen", () => {
    expect(checkReport(ring, "x", "killer", []).ok).toBe(false);
  });

  it("nekter dobbel melding av samme drap", () => {
    const res = checkReport(ring, "b", "victim", [kill({})]);
    expect(res.ok).toBe(false);
  });

  it("tillater ny melding når forrige ble avvist", () => {
    expect(checkReport(ring, "a", "killer", [kill({ status: "rejected" })]).ok).toBe(true);
  });
});

describe("tidsavbrudd", () => {
  it("går til arrangørene etter 12 timer uten svar", () => {
    const k = kill({ reportedAt: t(0) });
    expect(isOverdue(k, new Date(t(0).getTime() + CONFIRM_TIMEOUT_MS - 1))).toBe(false);
    expect(isOverdue(k, new Date(t(0).getTime() + CONFIRM_TIMEOUT_MS))).toBe(true);
    expect(isOverdue({ ...k, status: "escalated" }, now)).toBe(false);
  });
});

describe("kollisjoner", () => {
  it("ingen kollisjon for et rent drap", () => {
    expect(findCollisions(kill({}), [kill({})], start, now)).toEqual([]);
  });

  it("offeret melder eget drap etter sitt eget dødstidspunkt", () => {
    const death = kill({ id: "k1", killerId: "a", victimId: "b", killedAt: t(10) });
    const late = kill({ id: "k2", killerId: "b", victimId: "c", killedAt: t(11) });
    expect(findCollisions(death, [death, late], start, now)).toContain(
      "Offeret har meldt et eget drap etter sitt eget dødstidspunkt",
    );
    expect(findCollisions(late, [death, late], start, now)).toContain(
      "Morderen er meldt drept før dette drapstidspunktet",
    );
  });

  it("samme minutt regnes ikke som etter", () => {
    const death = kill({ id: "k1", killerId: "a", victimId: "b", killedAt: t(10) });
    const same = kill({ id: "k2", killerId: "b", victimId: "c", killedAt: t(10) });
    expect(findCollisions(death, [death, same], start, now)).toEqual([]);
    expect(findCollisions(same, [death, same], start, now)).toEqual([]);
  });

  it("et drap før eget dødstidspunkt er ikke en kollisjon", () => {
    const death = kill({ id: "k1", killerId: "a", victimId: "b", killedAt: t(12) });
    const early = kill({ id: "k2", killerId: "b", victimId: "c", killedAt: t(11) });
    expect(findCollisions(early, [death, early], start, now)).toEqual([]);
  });

  it("samme offer i to saker", () => {
    const one = kill({ id: "k1" });
    const two = kill({ id: "k2", killerId: "z" });
    expect(findCollisions(two, [one, two], start, now)).toContain("Offeret er også meldt drept i en annen sak");
  });

  it("et gammelt drap på en som har fått nåde teller ikke", () => {
    const old = kill({ id: "k1", killerId: "a", victimId: "b", status: "applied", killedAt: t(8) });
    const again = kill({ id: "k2", killerId: "c", victimId: "b", killedAt: t(12) });
    expect(findCollisions(again, [old, again], start, now, new Set(["b", "c"]))).toEqual([]);
    expect(findCollisions(again, [old, again], start, now, new Set(["c"]))).toContain("Offeret er også meldt drept i en annen sak");
    const byRevived = kill({ id: "k3", killerId: "b", victimId: "d", killedAt: t(12) });
    expect(findCollisions(byRevived, [old, byRevived], start, now, new Set(["b", "d"]))).toEqual([]);
  });

  it("avviste og angrede saker teller ikke", () => {
    const one = kill({ id: "k1", status: "rejected" });
    const two = kill({ id: "k2", killerId: "z", status: "undone" });
    const three = kill({ id: "k3" });
    expect(findCollisions(three, [one, two, three], start, now)).toEqual([]);
  });

  it("drap i samme minutt som starten er gyldig", () => {
    const started = new Date(Date.UTC(2026, 10, 2, 9, 0, 32));
    expect(findCollisions(kill({ killedAt: new Date(Date.UTC(2026, 10, 2, 9, 0)) }), [], started, now)).toEqual([]);
    expect(findCollisions(kill({ killedAt: new Date(Date.UTC(2026, 10, 2, 8, 59)) }), [], started, now)).toHaveLength(1);
  });

  it("tidspunkt før start og i framtiden flagges", () => {
    expect(findCollisions(kill({ killedAt: new Date(start.getTime() - 1) }), [], start, now)).toHaveLength(1);
    expect(findCollisions(kill({ killedAt: new Date(now.getTime() + 3_600_000) }), [], start, now)).toHaveLength(1);
  });
});

describe("decideOnConfirm", () => {
  it("bruker drapet når alt stemmer", () => {
    expect(decideOnConfirm(kill({}), ["a", "b", "c"], [], start, now)).toEqual({ action: "apply" });
  });

  it("sender til arrangørene når sirkelen har endret seg", () => {
    const res = decideOnConfirm(kill({}), ["a", "c", "b"], [], start, now);
    expect(res.action).toBe("escalate");
  });

  it("sender kollisjoner til arrangørene", () => {
    const death = kill({ id: "k1", killedAt: t(10) });
    const late = kill({ id: "k2", killerId: "b", victimId: "c", killedAt: t(11) });
    expect(decideOnConfirm(death, ["a", "b", "c"], [death, late], start, now).action).toBe("escalate");
  });
});

describe("canBeDisqualified", () => {
  it("nekter diskvalifisering med uavklart sak, både som morder og offer", () => {
    expect(canBeDisqualified("a", [kill({})])).toBe(false);
    expect(canBeDisqualified("b", [kill({ status: "escalated" })])).toBe(false);
    expect(canBeDisqualified("c", [kill({})])).toBe(true);
    expect(canBeDisqualified("a", [kill({ status: "applied" })])).toBe(true);
  });
});
