import { createFileRoute, Outlet } from "@tanstack/react-router";
import { redirect } from "next/navigation";
import { AdminShell, type AdminNavGroup } from "@/components/AdminShell";
import { PendingKillBanner } from "@/components/PendingKillBanner";
import { redirectToLogin } from "@/lib/guard";
import { getViewer } from "@/server/auth/session";
async function AdminLayout() {
    const viewer = await getViewer();
    if (!viewer)
        return redirectToLogin();
    if (!viewer.isGamemaster && !viewer.canManageRoles)
        redirect("/");
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
    return (<AdminShell groups={groups} banner={<PendingKillBanner className="mx-auto w-full max-w-7xl px-4 md:px-8"/>} user={{ name: viewer.user.name, image: viewer.user.photonImage, hasProfile: !!viewer.player }}>
      <Outlet />
    </AdminShell>);
}

export const Route = createFileRoute("/admin")({ component: AdminLayout });
