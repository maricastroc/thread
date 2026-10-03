"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SearchIcon } from "@/components/icons";
import { t } from "@/lib/i18n";

export function HeaderSearch({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/search")) return null;
  return (
    <>
      <Link
        href="/search"
        aria-label={t.search.title}
        className="hidden size-11 shrink-0 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-ink/[0.06] hover:text-ink lg:inline-flex xl:hidden"
      >
        <SearchIcon size={18} />
      </Link>
      <div className="hidden w-[18rem] xl:block">{children}</div>
    </>
  );
}
