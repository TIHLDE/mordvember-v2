import { beforeEach, expect, it, vi } from "vite-plus/test";
import { Route } from "./page";

const { viewer, count, reviews } = vi.hoisted(() => ({
  viewer: vi.fn(),
  count: vi.fn().mockResolvedValue(2),
  reviews: vi.fn().mockResolvedValue(3),
}));
vi.mock("@/server/auth/session", () => ({ requireViewer: viewer }));
vi.mock("@/db", () => ({ db: { $count: count } }));
vi.mock("@/server/weekly", () => ({ pendingReviewCount: reviews }));
vi.mock("./actions", () => ({ createSeasonAction: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({ handler: (handler: () => Promise<unknown>) => handler }),
  useServerFn: vi.fn(),
}));

async function load() {
  const loader = Route.options.loader;
  if (typeof loader !== "function") throw new Error("Missing loader");
  return loader({} as never);
}

beforeEach(() => vi.clearAllMocks());

it("rejects direct dashboard RPC calls from ordinary members", async () => {
  viewer.mockResolvedValue({ isGamemaster: false, canManageRoles: false });
  await expect(load()).rejects.toMatchObject({ isNotFound: true });
  expect(count).not.toHaveBeenCalled();
});

it("does not query or serialize moderation counts for role managers", async () => {
  viewer.mockResolvedValue({
    isGamemaster: false,
    canManageRoles: true,
    season: { id: "season", phase: "signup" },
  });
  const result = await load();
  expect(result?.summary?.items).toEqual([]);
  expect(count).toHaveBeenCalledTimes(2);
  expect(reviews).not.toHaveBeenCalled();
});
