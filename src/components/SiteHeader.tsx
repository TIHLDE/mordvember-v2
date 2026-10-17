import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getViewer } from "@/server/auth/session";
import { UserAvatar } from "./Avatar";
import { NavLinks, type NavLink } from "./NavLinks";
import { buttonClass, cx } from "./ui";
import { openKillsForPlayer } from "@/server/game";

export async function SiteHeader() {
  const viewer = await getViewer();
  let unread = 0;
  let waiting = 0;
  if (viewer) {
    unread = await db.$count(notifications, and(eq(notifications.userId, viewer.user.id), isNull(notifications.readAt)));
    if (viewer.season && viewer.player) {
      const open = await openKillsForPlayer(viewer.season.id, viewer.player.id);
      waiting = open.filter((k) => k.status === "pending" && (k.reportedBy === "killer" ? k.victimId : k.killerId) === viewer.player!.id).length;
    }
  }
  const playing = viewer?.player && viewer.season && viewer.season.phase === "running";
  const links: NavLink[] = viewer
    ? [
        { href: "/", label: "Deltakere", exact: true },
        ...(playing && viewer.player?.status === "alive"
          ? [
              { href: "/offer", label: "Mitt offer" },
              { href: "/drap", label: "Drap" },
              { href: "/oppmote", label: "Oppmøte" },
            ]
          : []),
        { href: "/sporsmal", label: "Spørsmål" },
        { href: "/varsler", label: "Varsler", count: unread },
        ...(viewer.isStaff || viewer.canManageRoles ? [{ href: "/admin", label: "Admin" }] : []),
      ]
    : [];
  const container = "mx-auto max-w-5xl px-4";

  return (
    <>
      <header className="material sticky top-0 z-40 border-b border-white/10 bg-ink/75 backdrop-blur-xl backdrop-saturate-150">
        <div className={container}>
          <div className="flex h-14 items-center gap-6">
            <Link href="/" className="font-display text-2xl text-blood">
              Mordvember
            </Link>
            {links.length > 0 && <NavLinks links={links} className="hidden flex-1 lg:flex" />}
            <div className="ml-auto flex items-center gap-2">
              {viewer ? (
                <>
                  <form action="/api/auth/logout" method="post">
                    <button className="inline-flex min-h-9 items-center rounded-lg px-3 text-sm text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200">
                      Logg ut
                    </button>
                  </form>
                  {viewer.player ? (
                    <Link href="/profil" aria-label="Gå til profil" className="rounded-full transition-shadow hover:ring-2 hover:ring-blood/60">
                      <UserAvatar name={viewer.user.name} image={viewer.user.photonImage} />
                    </Link>
                  ) : (
                    <UserAvatar name={viewer.user.name} image={viewer.user.photonImage} />
                  )}
                </>
              ) : (
                <Link href="/login" className={buttonClass({ variant: "ghost", size: "sm" })}>
                  Logg inn
                </Link>
              )}
            </div>
          </div>
          {links.length > 0 && <NavLinks links={links} className="-mx-1 pb-3 lg:hidden" />}
        </div>
      </header>
      {waiting > 0 && (
        <div className="bg-blood/90 text-white">
          <div className={cx(container, "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5 text-sm")}>
            <span>Et drap du er part i venter på svar fra deg.</span>
            <Link href="/drap" className="inline-flex min-h-8 items-center rounded-lg bg-white/15 px-3 font-medium transition-colors hover:bg-white/25">
              Bekreft eller avvis
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
