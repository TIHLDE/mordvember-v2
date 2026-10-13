import "server-only";
import { notFound, redirect } from "next/navigation";
import { getViewer, type Season, type Viewer } from "@/server/auth/session";

type Need = "staff" | "gamemaster" | "circle" | "roles" | "index";

export async function guard(need: Need): Promise<Viewer & { season: Season }> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/admin");
  const ok =
    need === "staff"
      ? viewer.isStaff
      : need === "gamemaster"
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
