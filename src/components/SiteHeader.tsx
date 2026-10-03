import Link from "next/link";
import { HeaderSearch } from "@/components/HeaderSearch";
import { NavLink } from "@/components/NavLink";
import { SearchField } from "@/components/SearchField";
import { RecordDot } from "@/components/icons";
import { t } from "@/lib/i18n";

export function RecordLink({ className = "", label = t.nav.record }: { className?: string; label?: string }) {
  return (
    <Link
      href="/record"
      className={`inline-flex h-11 items-center gap-2.5 rounded-full bg-voice pr-5 pl-4 text-[0.9375rem] font-medium text-on-voice transition-[filter,transform] duration-150 hover:brightness-110 active:scale-[0.98] ${className}`}
    >
      <RecordDot size={10} />
      {label}
    </Link>
  );
}

export function SiteHeader({ narrator, search = true }: { narrator: string | null; search?: boolean }) {
  return (
    <header className="relative z-30">
      <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 sm:min-h-20 sm:gap-x-6 sm:px-6">
        <Link href="/" className="-ml-1 rounded px-1 font-serif text-[1.5rem] leading-none tracking-[-0.02em]">
          {t.brand}
        </Link>
        {narrator && (
          <nav aria-label={t.nav.label} className="hidden items-center md:flex">
            <NavLink href="/">{t.nav.stories}</NavLink>
            <NavLink href="/people">{t.nav.people}</NavLink>
            <NavLink href="/places">{t.nav.places}</NavLink>
          </nav>
        )}
        <div className="flex-1" />
        {narrator && search && (
          <HeaderSearch>
            <SearchField narrator={narrator} id="header-search" />
          </HeaderSearch>
        )}
        {narrator && <RecordLink />}
      </div>
      {narrator && (
        <nav aria-label={t.nav.label} className="mx-auto -mt-2 flex max-w-6xl flex-wrap items-center gap-x-1 px-2 pb-1 md:hidden">
          <NavLink href="/">{t.nav.stories}</NavLink>
          <NavLink href="/people">{t.nav.people}</NavLink>
          <NavLink href="/places">{t.nav.places}</NavLink>
          <NavLink href="/search">{t.search.title}</NavLink>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-24 max-w-6xl px-4 pb-10 sm:px-6">
      <p className="t-small flex items-center gap-2 border-t border-rule pt-6 text-ink-2">
        <span aria-hidden="true" className="inline-block size-1.5 rounded-full bg-ink-3" />
        {t.privacy}
      </p>
    </footer>
  );
}
