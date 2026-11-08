import "@tanstack/react-start/server-only";
import { getRequestUrl, getRequestHeader } from "@tanstack/react-start/server";
import { notFound, redirect } from "@tanstack/react-router";
import { PATH_HEADER, safeNext } from "@/lib/redirect";
import { getViewer, type Season, type Viewer } from "@/server/auth/session";

/** Sends a logged-out visitor to login, and back to the page they asked for afterwards. */
export async function redirectToLogin(): Promise<never> {
  const path = safeNext(
    getRequestHeader(PATH_HEADER) ?? getRequestUrl().pathname + getRequestUrl().search,
  );
  throw redirect({ to: "/login", search: { next: path } });
}

type Need = "gamemaster" | "circle" | "roles" | "index";

export async function guard(need: Need): Promise<Viewer & { season: Season }> {
  const viewer = await getViewer();
  if (!viewer) return redirectToLogin();
  const ok =
    need === "gamemaster"
      ? viewer.isGamemaster
      : need === "circle"
        ? viewer.canSeeCircle
        : need === "roles"
          ? viewer.canManageRoles
          : viewer.isIndexLeader;
  if (!ok) throw notFound();
  if (!viewer.season) throw redirect({ to: "/admin" });
  return viewer as Viewer & { season: Season };
}
