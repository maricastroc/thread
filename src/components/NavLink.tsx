"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children, also = [], className = "" }: { href: string; children: React.ReactNode; also?: string[]; className?: string }) {
  const pathname = usePathname();
  const current = href === "/" ? pathname === "/" : [href, ...also].some((prefix) => pathname.startsWith(prefix));
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`relative inline-flex h-11 items-center px-2 text-[0.9375rem] transition-colors duration-150 ${
        current ? "text-ink" : "text-ink-2 hover:text-ink"
      } after:absolute after:inset-x-2 after:bottom-2 after:h-px after:origin-left after:bg-ink after:transition-transform after:duration-200 ${
        current ? "after:scale-x-100" : "after:scale-x-0 hover:after:scale-x-100"
      } ${className}`}
    >
      {children}
    </Link>
  );
}
