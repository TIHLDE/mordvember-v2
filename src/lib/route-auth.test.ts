import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { requireLogin } from "./route-auth";

const { authStatus } = vi.hoisted(() => ({
  authStatus: vi.fn<() => Promise<{ signedIn: boolean; hasPendingScan: boolean }>>(),
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({ handler: () => authStatus }),
}));
vi.mock("@tanstack/react-start/server", () => ({ getCookie: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ getViewer: vi.fn() }));
vi.mock("@/server/attendance", () => ({ PENDING_SCAN_COOKIE: "mv_pending_scan" }));

beforeEach(() => authStatus.mockResolvedValue({ signedIn: false, hasPendingScan: false }));

function location(href: string) {
  const url = new URL(href, "http://localhost");
  return { href, pathname: url.pathname, searchStr: url.search };
}

describe("route login guard", () => {
  it("preserves the destination and query when login is required", async () => {
    await expect(requireLogin({ location: location("/admin/sirkel?x=1") })).rejects.toMatchObject({
      options: { to: "/login", search: { next: "/admin/sirkel?x=1" } },
    });
  });

  it("allows authenticated navigation", async () => {
    authStatus.mockResolvedValue({ signedIn: true, hasPendingScan: false });
    await expect(requireLogin({ location: location("/profil") })).resolves.toBeUndefined();
  });

  it("allows an invalid scan message to be read without login", async () => {
    await expect(
      requireLogin({ location: location("/sjekkinn/?feil=kode") }),
    ).resolves.toBeUndefined();
  });

  it("requires login when a pending scan can still be completed", async () => {
    authStatus.mockResolvedValue({ signedIn: false, hasPendingScan: true });
    await expect(requireLogin({ location: location("/sjekkinn?feil=kode") })).rejects.toMatchObject(
      {
        options: { to: "/login", search: { next: "/sjekkinn?feil=kode" } },
      },
    );
  });
});
