import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { runCron } from "@/server/cron";
import task from "./game-cron";

vi.mock("nitro/task", () => ({ defineTask: <T>(definition: T) => definition }));
vi.mock("@/server/cron", () => ({
  runCron: vi.fn<() => Promise<{ done: string[]; failed: string[] }>>(),
}));

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllEnvs());

describe("scheduled game cron", () => {
  it("returns completed work from the existing game job", async () => {
    const result = { done: ["eskalert:1"], failed: [] };
    vi.mocked(runCron).mockResolvedValue(result);
    await expect(task.run({ name: "game:cron", payload: {}, context: {} })).resolves.toEqual({
      result,
    });
    expect(runCron).toHaveBeenCalledOnce();
  });

  it("fails the scheduled task when a game step fails", async () => {
    vi.mocked(runCron).mockResolvedValue({ done: [], failed: ["innsjekk"] });
    await expect(task.run({ name: "game:cron", payload: {}, context: {} })).rejects.toThrow(
      "Cron failed: innsjekk",
    );
  });
  it("refuses to run on Vercel without the cron authentication secret", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("CRON_SECRET", undefined);
    await expect(task.run({ name: "game:cron", payload: {}, context: {} })).rejects.toThrow(
      "CRON_SECRET is required on Vercel",
    );
    expect(runCron).not.toHaveBeenCalled();
  });
});
