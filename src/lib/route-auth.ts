import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { getViewer } from "@/server/auth/session";
import { PENDING_SCAN_COOKIE } from "@/server/attendance";
import { safeNext } from "./redirect";

const getAuthStatus = createServerFn({ method: "GET" }).handler(async () => ({
  signedIn: !!(await getViewer()),
  hasPendingScan: !!getCookie(PENDING_SCAN_COOKIE),
}));

export async function requireLogin({
  location,
}: {
  location: { pathname: string; href: string; searchStr: string };
}) {
  const { signedIn, hasPendingScan } = await getAuthStatus();
  // Invalid scans remain readable before login, as in the original check-in flow.
  const pathname = location.pathname.replace(/\/+$/, "") || "/";
  const invalidScan =
    pathname === "/sjekkinn" &&
    new URLSearchParams(location.searchStr).get("feil") === "kode" &&
    !hasPendingScan;
  if (!signedIn && !invalidScan) {
    throw redirect({ to: "/login", search: { next: safeNext(location.href) } });
  }
}
