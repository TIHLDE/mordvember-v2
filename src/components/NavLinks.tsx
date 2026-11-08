"use client";

import { Link } from "@tanstack/react-router";
import { useLocation } from "@tanstack/react-router";
import { cx } from "./styles";

export type NavLink = { href: string; label: string; count?: number; exact?: boolean };

export function NavLinks({
  links,
  vertical = false,
  className = "",
}: {
  links: NavLink[];
  vertical?: boolean;
  className?: string;
}) {
  const pathname = useLocation({ select: (location) => location.pathname });
  return (
    <nav className={cx("flex gap-1", vertical ? "flex-wrap md:flex-col" : "flex-wrap", className)}>
      {links.map((l) => {
        const active = l.exact
          ? pathname === l.href
          : pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            to={l.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm transition-colors duration-150",
              active ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white",
            )}
          >
            {l.label}
            {!!l.count && (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-blood px-1.5 text-xs leading-5 font-medium text-white tabular-nums">
                {l.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
