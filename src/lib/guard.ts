import "@tanstack/react-start/server-only";
import { notFound, redirect } from "@tanstack/react-router";
import { requireViewer, type Season, type Viewer } from "@/server/auth/session";

type Need = "gamemaster" | "circle" | "roles" | "index";

export async function guard(need: Need): Promise<Viewer & { season: Season }> {
  const viewer = await requireViewer();
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
