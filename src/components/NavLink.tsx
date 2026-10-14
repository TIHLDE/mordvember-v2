"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children, className = "", exact = false }: { href: string; children: React.ReactNode; className?: string; exact?: boolean }) {
  const pathname = usePathname();
  const active = exact || href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={className}>
      {children}
    </Link>
  );
}
