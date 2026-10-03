"use client";

import { usePathname } from "next/navigation";

export function HeaderSearch({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/" || pathname.startsWith("/search")) return null;
  return <div className="hidden w-[18rem] lg:block">{children}</div>;
}
