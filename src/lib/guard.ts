import "server-only";
import { notFound, redirect } from "next/navigation";
import { getViewer, type Season, type Viewer } from "@/server/auth/session";

type Need = "gamemaster" | "circle" | "roles" | "index";

export async function guard(need: Need): Promise<Viewer & { season: Season }> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/admin");
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
