"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { UserAvatar } from "./Avatar";
import { cx } from "./ui";

export type AdminNavGroup = { label?: string; links: { href: string; label: string; exact?: boolean }[] };

function isActive(pathname: string, link: { href: string; exact?: boolean }) {
  return link.exact ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`);
}

export function AdminShell({
  groups,
  user,
  banner,
  children,
}: {
  groups: AdminNavGroup[];
  user: { name: string; image: string | null; hasProfile: boolean };
  banner: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const current = groups.flatMap((g) => g.links).find((l) => isActive(pathname, l));
  const avatar = <UserAvatar name={user.name} image={user.image} />;

  return (
    <div className="min-h-dvh">
      {open && <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setOpen(false)} aria-hidden />}
      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-white/10 bg-ink transition-[translate,visibility] duration-200 ease-out-strong md:visible md:translate-x-0",
          open ? "visible translate-x-0" : "invisible -translate-x-full",
        )}
      >
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-white/10 px-4">
          <Link href="/" className="font-display text-2xl text-blood">
            Mordvember
          </Link>
          <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-xs font-medium text-zinc-300">Admin</span>
        </div>
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {groups.map((g, i) => (
            <div key={g.label ?? i}>
              {g.label && <p className="mb-1 px-3 text-xs font-medium text-zinc-500">{g.label}</p>}
              <ul className="space-y-0.5">
                {g.links.map((l) => {
                  const active = isActive(pathname, l);
                  return (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cx(
                          "flex min-h-9 items-center rounded-lg px-3 text-sm transition-colors duration-150",
                          active ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white",
                        )}
                      >
                        {l.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="shrink-0 border-t border-white/10 p-3">
          <Link
            href="/"
            className="flex min-h-9 items-center rounded-lg px-3 text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            ← Tilbake til spillet
          </Link>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col md:pl-64">
        <header className="material sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-white/10 bg-ink/75 px-4 backdrop-blur-xl backdrop-saturate-150 md:px-8">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Åpne menyen"
            className="-ml-2 inline-flex size-9 items-center justify-center rounded-lg text-zinc-300 transition-colors hover:bg-white/5 hover:text-white md:hidden"
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="size-5">
              <path d="M3 5h14M3 10h14M3 15h14" />
            </svg>
          </button>
          <p className="truncate text-sm text-zinc-400">
            <Link href="/admin" className="transition-colors hover:text-white">
              Admin
            </Link>
            {current && current.href !== "/admin" && (
              <>
                <span className="mx-2 text-zinc-600">/</span>
                <span className="text-white">{current.label}</span>
              </>
            )}
          </p>
          <div className="ml-auto flex items-center gap-2">
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="inline-flex min-h-9 items-center rounded-lg px-3 text-sm text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200">
                Logg ut
              </button>
            </form>
            {user.hasProfile ? (
              <Link href="/profil" aria-label="Gå til profil" className="rounded-full transition-shadow hover:ring-2 hover:ring-blood/60">
                {avatar}
              </Link>
            ) : (
              avatar
            )}
          </div>
        </header>
        {banner}
        <main className="mx-auto w-full max-w-7xl min-w-0 flex-1 px-4 pt-8 pb-16 md:px-8">{children}</main>
      </div>
    </div>
  );
}
