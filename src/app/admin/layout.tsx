import { redirect } from "next/navigation";
import { AdminShell, type AdminNavGroup } from "@/components/AdminShell";
import { getViewer } from "@/server/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/admin");
  if (!viewer.isStaff && !viewer.canManageRoles) redirect("/");
  const groups: AdminNavGroup[] = [
    { links: [{ href: "/admin", label: "Oversikt", show: true, exact: true }] },
    {
      label: "Spillet",
      links: [
        { href: "/admin/drap", label: "Drapssaker", show: viewer.isStaff },
        { href: "/admin/fredag", label: "Fredagslista", show: viewer.isStaff },
        { href: "/admin/oppmote", label: "Oppmøte", show: viewer.isStaff },
        { href: "/admin/bilder", label: "Bilder", show: viewer.isStaff },
        { href: "/admin/sporsmal", label: "Spørsmål", show: viewer.isStaff },
        { href: "/admin/deltakere", label: "Deltakere", show: viewer.isStaff },
        { href: "/admin/sirkel", label: "Sirkel", show: viewer.canSeeCircle },
      ],
    },
    {
      label: "Administrasjon",
      links: [
        { href: "/admin/sesong", label: "Sesong", show: viewer.isGamemaster },
        { href: "/admin/maler", label: "E-postmaler", show: viewer.isGamemaster },
        { href: "/admin/roller", label: "Roller", show: viewer.canManageRoles },
        { href: "/admin/logg", label: "Logg", show: viewer.isGamemaster },
        { href: "/admin/nodtilgang", label: "Nødtilgang", show: viewer.isIndexLeader },
      ],
    },
  ]
    .map((g) => ({ ...g, links: g.links.filter((l) => l.show).map(({ show: _, ...l }) => l) }))
    .filter((g) => g.links.length > 0);

  return (
    <AdminShell groups={groups} user={{ name: viewer.user.name, image: viewer.user.photonImage, hasProfile: !!viewer.player }}>
      {children}
    </AdminShell>
  );
}
