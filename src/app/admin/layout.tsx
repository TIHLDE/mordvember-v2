import { redirect } from "next/navigation";
import { NavLinks } from "@/components/NavLinks";
import { SiteHeader } from "@/components/SiteHeader";
import { getViewer } from "@/server/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/admin");
  if (!viewer.isStaff && !viewer.canManageRoles) redirect("/");
  const links = [
    { href: "/admin", label: "Oversikt", show: true, exact: true },
    { href: "/admin/drap", label: "Drapssaker", show: viewer.isStaff },
    { href: "/admin/fredag", label: "Fredagslista", show: viewer.isStaff },
    { href: "/admin/oppmote", label: "Oppmøte", show: viewer.isStaff },
    { href: "/admin/bilder", label: "Bilder", show: viewer.isStaff },
    { href: "/admin/sporsmal", label: "Spørsmål", show: viewer.isStaff },
    { href: "/admin/deltakere", label: "Deltakere", show: viewer.isStaff },
    { href: "/admin/sirkel", label: "Sirkel", show: viewer.canSeeCircle },
    { href: "/admin/sesong", label: "Sesong", show: viewer.isGamemaster },
    { href: "/admin/maler", label: "E-postmaler", show: viewer.isGamemaster },
    { href: "/admin/roller", label: "Roller", show: viewer.canManageRoles },
    { href: "/admin/logg", label: "Logg", show: viewer.isGamemaster },
    { href: "/admin/nodtilgang", label: "Nødtilgang", show: viewer.isIndexLeader },
  ].filter((l) => l.show);
  return (
    <>
      <SiteHeader wide />
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pt-8 pb-16 md:flex-row md:gap-10">
        <aside className="md:sticky md:top-32 lg:top-22 md:w-48 md:shrink-0 md:self-start">
          <NavLinks links={links} vertical className="-mx-1" />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </>
  );
}
