import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getViewer } from "@/server/auth/session";
import { UserAvatar } from "./Avatar";
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
  const links = viewer
    ? [
        { href: "/", label: "Deltakere" },
        ...(playing && viewer.player?.status === "alive"
          ? [
              { href: "/offer", label: "Mitt offer" },
              { href: "/drap", label: "Drap" },
              { href: "/oppmote", label: "Oppmøte" },
            ]
          : []),
        { href: "/sporsmal", label: "Spørsmål" },
        { href: "/varsler", label: unread ? `Varsler (${unread})` : "Varsler" },
        ...(viewer.isStaff || viewer.canManageRoles ? [{ href: "/admin", label: "Admin" }] : []),
      ]
    : [];

  return (
    <>
      <header className="border-b border-white/10 bg-black/40 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
          <Link href="/" className="font-display text-2xl text-blood">
            Mordvember
          </Link>
          <nav className="flex flex-1 flex-wrap gap-x-4 gap-y-1 text-sm">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-zinc-300 hover:text-white">
                {l.label}
              </Link>
            ))}
          </nav>
          {viewer ? (
            <div className="flex items-center gap-4">
              <form action="/api/auth/logout" method="post">
                <button className="text-sm text-zinc-500 hover:text-zinc-300">Logg ut</button>
              </form>
              {viewer.player ? (
                <Link href="/profil" aria-label="Gå til profil" className="rounded-full hover:ring-2 hover:ring-blood/60">
                  <UserAvatar name={viewer.user.name} image={viewer.user.photonImage} />
                </Link>
              ) : (
                <UserAvatar name={viewer.user.name} image={viewer.user.photonImage} />
              )}
            </div>
          ) : (
            <Link href="/login" className="text-sm text-zinc-300 hover:text-white">
              Logg inn
            </Link>
          )}
        </div>
      </header>
      {waiting > 0 && (
        <div className="bg-blood/90 text-white">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
            <span>Et drap du er part i venter på svar fra deg.</span>
            <Link href="/drap" className="rounded bg-white/15 px-3 py-1 font-medium hover:bg-white/25">
              Bekreft eller avvis
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
