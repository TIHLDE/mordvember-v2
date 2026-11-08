import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { runCron } from "@/server/cron";
import task from "./game-cron";

vi.mock("nitro/task", () => ({ defineTask: <T>(definition: T) => definition }));
vi.mock("@/server/cron", () => ({
  runCron: vi.fn<() => Promise<{ done: string[]; failed: string[] }>>(),
}));

beforeEach(() => vi.clearAllMocks());

describe("scheduled game cron", () => {
  it("returns completed work from the existing game job", async () => {
    const result = { done: ["eskalert:1"], failed: [] };
    vi.mocked(runCron).mockResolvedValue(result);
    await expect(task.run({ name: "game:cron", payload: {}, context: {} })).resolves.toEqual({ result });
    expect(runCron).toHaveBeenCalledOnce();
  });

  it("fails the scheduled task when a game step fails", async () => {
    vi.mocked(runCron).mockResolvedValue({ done: [], failed: ["innsjekk"] });
    await expect(task.run({ name: "game:cron", payload: {}, context: {} })).rejects.toThrow("Cron failed: innsjekk");
  });
});
