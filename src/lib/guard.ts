import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { PATH_HEADER, safeNext } from "@/lib/redirect";
import { getViewer, type Season, type Viewer } from "@/server/auth/session";

/** Sends a logged-out visitor to login, and back to the page they asked for afterwards. */
export async function redirectToLogin(): Promise<never> {
  const path = safeNext((await headers()).get(PATH_HEADER));
  redirect(`/login?next=${encodeURIComponent(path)}`);
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
  if (!ok) notFound();
  if (!viewer.season) redirect("/admin");
  return viewer as Viewer & { season: Season };
}
