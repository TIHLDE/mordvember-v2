import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.join(__dirname, "..", "src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return files(full);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") ? [full] : [];
  });
}

const sources = files(root).map((file) => ({ file: path.relative(root, file), text: readFileSync(file, "utf8") }));

describe("tilgang til sirkelen", () => {
  it("bare sirkelmodulen leser sirkeltabellene", () => {
    const users = sources.filter(
      (s) => /\bcircles\b|\bcircleEvents\b|from circles|circle_events/.test(s.text) && s.file !== "db/schema.ts",
    );
    expect(users.map((u) => u.file).sort()).toEqual(["server/admin.ts", "server/circle.ts"]);
    const admin = sources.find((s) => s.file === "server/admin.ts")!.text;
    expect(admin.match(/circles|circle_events/g)).toEqual(["circles", "circle_events"]);
    expect(admin).toMatch(/delete from circles where season_id/);
    expect(admin).toMatch(/delete from circle_events where season_id/);
  });

  it("bare godkjente filer importerer sirkelmodulen", () => {
    const importers = sources.filter((s) => /from "@\/server\/circle"|from "\.\/circle"/.test(s.text)).map((s) => s.file);
    expect(importers.sort()).toEqual(["app/(site)/actions.ts", "app/admin/sirkel/page.tsx", "server/game.ts"]);
  });

  it("deltakerhandlingene bruker bare myTarget fra sirkelmodulen", () => {
    const actions = sources.find((s) => s.file === "app/(site)/actions.ts")!.text;
    expect(actions).toMatch(/import \{ myTarget \} from "@\/server\/circle";/);
  });

  it("sirkelsiden sjekker nødtilgang eller spillmester før noe vises", () => {
    const page = sources.find((s) => s.file === "app/admin/sirkel/page.tsx")!.text;
    expect(page).toMatch(/await guard\("circle"\)/);
    const circle = sources.find((s) => s.file === "server/circle.ts")!.text;
    for (const fn of ["circleForAdmin", "circleEventsForAdmin"]) {
      const body = circle.slice(circle.indexOf(`export async function ${fn}`));
      expect(body.slice(0, 300)).toMatch(/viewer\.canSeeCircle/);
    }
  });

  it("myTarget gir bare eget offer, og bare når spillet pågår og deltakeren lever", () => {
    const circle = sources.find((s) => s.file === "server/circle.ts")!.text;
    const body = circle.slice(circle.indexOf("export async function myTarget"), circle.indexOf("export type CircleEntry"));
    expect(body).toMatch(/viewer\.player\.status !== "alive"/);
    expect(body).toMatch(/phase !== "running"/);
    expect(body).toMatch(/targetOf\(ring, viewer\.player\.id\)/);
    expect(body).toMatch(/columns: \{ id: true, name: true, bio: true \}/);
  });

  it("game.ts returnerer aldri sirkelen", () => {
    const game = sources.find((s) => s.file === "server/game.ts")!.text;
    expect(game).not.toMatch(/return (before|after|ring)\b/);
    expect(game).not.toMatch(/ringForServer/);
  });

  it("hver adminhandling krever innlogging med riktig rolle", () => {
    const actions = sources.find((s) => s.file === "app/admin/actions.ts")!.text;
    const exported = [...actions.matchAll(/export async function (\w+)\([^)]*\) \{([\s\S]*?)\n\}/g)];
    expect(exported.length).toBeGreaterThan(20);
    for (const [, name, body] of exported) {
      expect(body, name).toMatch(/require(Gamemaster|Staff|Season|Viewer)\(\)/);
    }
    const gmOnly = ["undoKillAction", "generateCircleAction", "startGameAction", "moveAction", "mercyAction", "deleteSeasonDataAction", "setPhaseAction"];
    for (const name of gmOnly) {
      const match = exported.find(([, n]) => n === name);
      expect(match?.[2], name).toMatch(/requireGamemaster\(\)/);
    }
  });

  it("utviklerinnlogging er sperret utenfor utvikling", () => {
    const dev = sources.find((s) => s.file === "app/(site)/dev/page.tsx")!.text;
    expect(dev.match(/process\.env\.NODE_ENV !== "development"\) notFound\(\)/g)?.length).toBe(2);
    expect(dev).toMatch(/startsWith\(TEST_PREFIX\)/);
  });
});
