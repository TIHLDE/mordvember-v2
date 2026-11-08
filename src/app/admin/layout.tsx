import { createServerFn } from "@tanstack/react-start";

import { createFileRoute, Outlet } from "@tanstack/react-router";
import { redirect } from "@tanstack/react-router";
import { AdminShell, type AdminNavGroup } from "@/components/AdminShell";
import { PendingKillBanner } from "@/components/PendingKillBanner";


function AdminLayout() {
 const { viewer, waiting, groups } = Route.useLoaderData();
return (<AdminShell groups={groups} banner={<PendingKillBanner waiting={waiting} className="mx-auto w-full max-w-7xl px-4 md:px-8"/>} user={{ name: viewer.user.name, image: viewer.user.photonImage, hasProfile: !!viewer.player }}>
      <Outlet />
    </AdminShell>);
}

export const Route = createFileRoute("/admin")({ loader: () => loadAdminLayout(), component: AdminLayout });

const loadAdminLayout = createServerFn({ method: "GET" }).handler(async () => {
const { getNavigation } = await import("@/server/navigation");
const { redirectToLogin } = await import("@/lib/guard");
const { getViewer } = await import("@/server/auth/session");
const viewer = await getViewer();
const { waiting } = await getNavigation();
if (!viewer)
        return redirectToLogin();
if (!viewer.isGamemaster && !viewer.canManageRoles)
        throw redirect({ to: "/" });
const groups: AdminNavGroup[] = [
        { links: [{ href: "/admin", label: "Oversikt", show: true, exact: true }] },
        {
            label: "Spillet",
            links: [
                { href: "/admin/drap", label: "Drapssaker", show: viewer.isGamemaster },
                { href: "/admin/fredag", label: "Fredagslista", show: viewer.isGamemaster },
                { href: "/admin/oppmote", label: "Oppmøte", show: viewer.isGamemaster },
                { href: "/admin/sporsmal", label: "Spørsmål", show: viewer.isGamemaster },
                { href: "/admin/deltakere", label: "Deltakere", show: viewer.isGamemaster },
                { href: "/admin/sirkel", label: "Sirkel", show: viewer.canSeeCircle },
            ],
        },
        {
            label: "Administrasjon",
            links: [
                { href: "/admin/sesong", label: "Spill", show: viewer.isGamemaster },
                { href: "/admin/maler", label: "E-postmaler", show: viewer.isGamemaster },
                { href: "/admin/roller", label: "Spillmestere", show: viewer.canManageRoles },
                { href: "/admin/logg", label: "Logg", show: viewer.isGamemaster },
                { href: "/admin/nodtilgang", label: "Nødtilgang", show: viewer.isIndexLeader },
            ],
        },
    ]
        .map((g) => ({ ...g, links: g.links.filter((l) => l.show).map(({ show: _, ...l }) => l) }))
        .filter((g) => g.links.length > 0);
return { viewer, waiting, groups };
});
