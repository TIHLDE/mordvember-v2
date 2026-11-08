import { beforeEach, expect, it, vi } from "vite-plus/test";
import { run } from "./action";

const { request, deliver } = vi.hoisted(() => ({
  request: vi.fn(),
  deliver: vi.fn<() => Promise<number>>(),
}));
vi.mock("@tanstack/react-start/server", () => ({ getRequest: request }));
vi.mock("@/server/email", () => ({ deliverPendingEmails: deliver }));
vi.mock("@/server/auth/session", () => ({ AccessError: class extends Error {} }));
vi.mock("@/server/game", () => ({ GameError: class extends Error {} }));

beforeEach(() => vi.resetAllMocks());

it("responds while background email delivery is still pending", async () => {
  const waitUntil = vi.fn();
  request.mockReturnValue({ waitUntil });
  deliver.mockReturnValue(new Promise(() => {}));
  const result = await run(async () => "Saved");
  expect(result?.ok).toBe("Saved");
  expect(waitUntil).toHaveBeenCalledWith(expect.any(Promise));
});

it("leaves email delivery to cron when the runtime cannot retain background work", async () => {
  request.mockReturnValue(new Request("http://localhost"));
  expect((await run(async () => {}))?.ok).toBe("Lagret");
  expect(deliver).not.toHaveBeenCalled();
});
