import { redirect } from "next/navigation";
import { NavLink } from "@/components/NavLink";
import { SiteHeader } from "@/components/SiteHeader";
import { getViewer } from "@/server/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/admin");
  if (!viewer.isStaff && !viewer.canManageRoles) redirect("/");
  const links = [
    { href: "/admin", label: "Oversikt", show: true },
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
      <SiteHeader />
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row">
        <nav className="flex flex-wrap gap-2 md:w-44 md:flex-col md:gap-1">
          {links.map((l) => (
            <NavLink key={l.href} href={l.href} exact={l.href === "/admin"} className="press rounded px-3 py-1.5 text-sm text-zinc-400 hover:bg-white/5 hover:text-white aria-[current=page]:bg-white/[0.07] aria-[current=page]:text-white">
              {l.label}
            </NavLink>
          ))}
        </nav>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </>
  );
}
