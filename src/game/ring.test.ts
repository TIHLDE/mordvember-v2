import { describe, expect, it } from "vitest";
import {
  applyKill,
  changedTargets,
  generateRing,
  hunterOf,
  insertAfter,
  isSingleRing,
  movePlayer,
  randomInsertAfter,
  removePlayers,
  type Ring,
  RingError,
  targetOf,
  targetsOf,
  undoKill,
} from "./ring";
import { seeded } from "./random";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);

function assertOneCycle(ring: Ring) {
  const targets = targetsOf(ring);
  if (ring.length < 2) return;
  const start = ring[0] as string;
  const seen = new Set<string>();
  let cur = start;
  do {
    expect(seen.has(cur)).toBe(false);
    seen.add(cur);
    cur = targets.get(cur) as string;
  } while (cur !== start);
  expect(seen.size).toBe(ring.length);
  for (const id of ring) expect(targets.get(id)).not.toBe(id);
}

describe("generateRing", () => {
  it("gir én ring over alle deltakere for mange størrelser og frø", () => {
    for (let n = 2; n <= 60; n++) {
      for (let seed = 0; seed < 5; seed++) {
        const players = ids(n);
        const ring = generateRing(players, seeded(seed * 100 + n));
        expect(isSingleRing(ring, players)).toBe(true);
        assertOneCycle(ring);
      }
    }
  });

  it("nekter færre enn to og duplikater", () => {
    expect(() => generateRing(["a"], seeded(1))).toThrow(RingError);
    expect(() => generateRing([], seeded(1))).toThrow(RingError);
    expect(() => generateRing(["a", "a", "b"], seeded(1))).toThrow(RingError);
  });

  it("trekker forskjellig med forskjellige frø", () => {
    const a = generateRing(ids(20), seeded(1)).join();
    const b = generateRing(ids(20), seeded(2)).join();
    expect(a).not.toBe(b);
  });
});

describe("mål og jeger", () => {
  it("to igjen har hverandre", () => {
    const ring = ["a", "b"];
    expect(targetOf(ring, "a")).toBe("b");
    expect(targetOf(ring, "b")).toBe("a");
    expect(hunterOf(ring, "a")).toBe("b");
  });

  it("ukjent deltaker har verken mål eller jeger", () => {
    expect(targetOf(["a", "b"], "x")).toBeNull();
    expect(hunterOf(["a", "b"], "x")).toBeNull();
    expect(targetOf(["a"], "a")).toBeNull();
  });
});

describe("applyKill", () => {
  it("morderen overtar offerets offer", () => {
    const ring = ["a", "b", "c", "d"];
    const after = applyKill(ring, "a", "b");
    expect(after).toEqual(["a", "c", "d"]);
    expect(targetOf(after, "a")).toBe("c");
  });

  it("nekter drap på noen som ikke er ens offer", () => {
    expect(() => applyKill(["a", "b", "c"], "a", "c")).toThrow(RingError);
    expect(() => applyKill(["a", "b", "c"], "a", "a")).toThrow(RingError);
    expect(() => applyKill(["a", "b", "c"], "x", "a")).toThrow(RingError);
  });

  it("tilfeldige drap holder sirkelen hel til én vinner står igjen", () => {
    for (let seed = 0; seed < 200; seed++) {
      const rng = seeded(seed);
      const players = ids(2 + Math.floor(rng() * 40));
      let ring = generateRing(players, rng);
      while (ring.length > 1) {
        const killer = ring[Math.floor(rng() * ring.length)] as string;
        const victim = targetOf(ring, killer) as string;
        ring = applyKill(ring, killer, victim);
        expect(new Set(ring).size).toBe(ring.length);
        assertOneCycle(ring);
      }
      expect(ring).toHaveLength(1);
    }
  });

  it("siste drap mellom to gir vinner", () => {
    expect(applyKill(["a", "b"], "b", "a")).toEqual(["b"]);
  });
});

describe("removePlayers (diskvalifisering)", () => {
  it("jegeren overtar offeret", () => {
    const after = removePlayers(["a", "b", "c", "d"], ["b"]);
    expect(targetOf(after, "a")).toBe("c");
  });

  it("flere på rad: jegeren hopper til neste levende", () => {
    const after = removePlayers(["a", "b", "c", "d", "e"], ["b", "c", "d"]);
    expect(after).toEqual(["a", "e"]);
    expect(targetOf(after, "a")).toBe("e");
    expect(targetOf(after, "e")).toBe("a");
  });

  it("over skjøten i lista", () => {
    const after = removePlayers(["a", "b", "c", "d", "e"], ["e", "a"]);
    expect(targetOf(after, "d")).toBe("b");
  });

  it("nekter ukjente", () => {
    expect(() => removePlayers(["a", "b"], ["x"])).toThrow(RingError);
  });

  it("tilfeldige utvalg holder sirkelen hel", () => {
    for (let seed = 0; seed < 300; seed++) {
      const rng = seeded(seed + 1000);
      const ring = generateRing(ids(3 + Math.floor(rng() * 30)), rng);
      const remove = ring.filter(() => rng() < 0.4);
      if (remove.length >= ring.length - 1) continue;
      const after = removePlayers(ring, remove);
      assertOneCycle(after);
      for (const id of remove) expect(after).not.toContain(id);
      for (const { hunterId, targetId } of changedTargets(ring, after)) {
        let walk = targetOf(ring, hunterId) as string;
        while (remove.includes(walk)) walk = targetOf(ring, walk) as string;
        expect(targetId).toBe(walk);
      }
    }
  });
});

describe("nåde", () => {
  it("A → B blir A → X → B", () => {
    const after = insertAfter(["a", "b", "c"], "x", "a");
    expect(targetOf(after, "a")).toBe("x");
    expect(targetOf(after, "x")).toBe("b");
    expect(changedTargets(["a", "b", "c"], after)).toEqual([
      { hunterId: "a", targetId: "x" },
      { hunterId: "x", targetId: "b" },
    ]);
  });

  it("tilfeldig plass gir alltid én ring", () => {
    for (let seed = 0; seed < 100; seed++) {
      const rng = seeded(seed + 5000);
      const ring = generateRing(ids(2 + Math.floor(rng() * 20)), rng);
      const after = randomInsertAfter(ring, "ny", rng);
      assertOneCycle(after);
      expect(after).toHaveLength(ring.length + 1);
    }
  });

  it("nekter dobbel innsetting og ukjent plass", () => {
    expect(() => insertAfter(["a", "b"], "a", "b")).toThrow(RingError);
    expect(() => insertAfter(["a", "b"], "x", "y")).toThrow(RingError);
  });
});

describe("movePlayer", () => {
  it("flytter en deltaker og beholder én ring", () => {
    const after = movePlayer(["a", "b", "c", "d"], "a", "c");
    expect(after).toEqual(["b", "c", "a", "d"]);
    assertOneCycle(after);
  });

  it("nekter å plassere noen etter seg selv", () => {
    expect(() => movePlayer(["a", "b", "c"], "a", "a")).toThrow(RingError);
  });
});

describe("undoKill", () => {
  it("setter sirkelen tilbake etter ett drap", () => {
    const before = ["a", "b", "c", "d"];
    const after = applyKill(before, "a", "b");
    expect(undoKill(after, "a", "b")).toEqual(before);
  });

  it("angrer et eldre drap etter at morderen har drept videre", () => {
    let ring: Ring = ["a", "b", "c", "d", "e"];
    ring = applyKill(ring, "a", "b");
    ring = applyKill(ring, "a", "c");
    const undone = undoKill(ring, "a", "b");
    expect(targetOf(undone, "a")).toBe("b");
    expect(targetOf(undone, "b")).toBe("d");
    assertOneCycle(undone);
  });

  it("nekter når morderen er ute eller offeret er inne", () => {
    expect(() => undoKill(["c", "d"], "a", "b")).toThrow(RingError);
    expect(() => undoKill(["a", "b"], "a", "b")).toThrow(RingError);
  });
});

describe("helt spill med blandede hendelser", () => {
  it("sirkelen er alltid én ring over nøyaktig de levende", () => {
    for (let seed = 0; seed < 300; seed++) {
      const rng = seeded(seed + 9000);
      const players = ids(2 + Math.floor(rng() * 50));
      let ring = generateRing(players, rng);
      const alive = new Set(players);
      const kills: { killer: string; victim: string }[] = [];
      let steps = 0;
      while (alive.size > 1 && steps++ < 500) {
        const roll = rng();
        if (roll < 0.6) {
          const killer = ring[Math.floor(rng() * ring.length)] as string;
          const victim = targetOf(ring, killer) as string;
          ring = applyKill(ring, killer, victim);
          alive.delete(victim);
          kills.push({ killer, victim });
        } else if (roll < 0.75 && ring.length > 3) {
          const run = 1 + Math.floor(rng() * Math.min(3, ring.length - 2));
          const from = Math.floor(rng() * ring.length);
          const out = Array.from({ length: run }, (_, i) => ring[(from + i) % ring.length] as string);
          ring = removePlayers(ring, out);
          out.forEach((id) => alive.delete(id));
        } else if (roll < 0.85) {
          const dead = players.filter((p) => !alive.has(p));
          if (!dead.length) continue;
          const x = dead[Math.floor(rng() * dead.length)] as string;
          ring = randomInsertAfter(ring, x, rng);
          alive.add(x);
        } else {
          const last = kills.pop();
          if (!last || alive.has(last.victim) || !alive.has(last.killer)) continue;
          ring = undoKill(ring, last.killer, last.victim);
          alive.add(last.victim);
        }
        expect(isSingleRing(ring, [...alive])).toBe(true);
        assertOneCycle(ring);
      }
    }
  });
});
