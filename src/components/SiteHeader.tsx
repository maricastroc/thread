import Link from "next/link";
import { AddStory } from "@/components/AddStory";
import { HeaderSearch } from "@/components/HeaderSearch";
import { NavLink } from "@/components/NavLink";
import { SearchField } from "@/components/SearchField";
import { RecordDot } from "@/components/icons";
import { ThemeChoice } from "@/components/ThemeChoice";
import { t } from "@/lib/i18n";

export function RecordLink({ className = "", label = t.nav.record }: { className?: string; label?: string }) {
  return (
    <Link
      href="/record"
      className={`inline-flex h-11 items-center gap-2.5 rounded-full bg-ink pr-5 pl-4 text-[0.9375rem] font-medium text-paper transition-[background-color,transform] duration-150 hover:bg-[color-mix(in_oklab,var(--text),var(--canvas)_16%)] active:scale-[0.98] ${className}`}
    >
      <RecordDot size={10} className="text-voice" />
      {label}
    </Link>
  );
}

function Sections() {
  return (
    <>
      <NavLink href="/">{t.nav.life}</NavLink>
      <NavLink href="/stories" also={["/themes"]}>
        {t.nav.stories}
      </NavLink>
      <NavLink href="/people">{t.nav.people}</NavLink>
      <NavLink href="/places">{t.nav.places}</NavLink>
      <span aria-hidden="true" className="mx-1.5 h-4 w-px bg-rule-2" />
      <NavLink href="/recordings">{t.nav.recordings}</NavLink>
    </>
  );
}

export function SiteHeader({ subject, search = true }: { subject: string | null; search?: boolean }) {
  return (
    <header className="relative z-30">
      <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 sm:min-h-20 sm:gap-x-6 sm:px-6">
        <Link
          href="/"
          aria-label={subject ? `${t.brand}, ${t.nav.archiveOf(subject)}` : t.brand}
          className="-ml-1 flex min-w-0 items-baseline gap-2 rounded px-1"
        >
          <span className="font-serif text-[1.5rem] leading-none tracking-[-0.02em]">{t.brand}</span>
          {subject && (
            <>
              <span aria-hidden="true" className="text-ink-3">
                /
              </span>
              <span className="max-w-[11rem] truncate text-[1rem] text-ink-2">{subject}</span>
            </>
          )}
        </Link>
        {subject && (
          <nav aria-label={t.nav.archiveOf(subject)} className="hidden items-center md:flex">
            <Sections />
          </nav>
        )}
        <div className="flex-1" />
        {subject && search && (
          <HeaderSearch>
            <SearchField subject={subject} id="header-search" />
          </HeaderSearch>
        )}
        {subject && <AddStory subject={subject} />}
      </div>
      {subject && (
        <nav aria-label={t.nav.archiveOf(subject)} className="mx-auto -mt-2 flex max-w-6xl flex-wrap items-center gap-x-1 px-2 pb-1 md:hidden">
          <Sections />
          <NavLink href="/search">{t.search.title}</NavLink>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-24 max-w-6xl px-4 pb-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-1 border-t border-rule pt-3">
        <p className="t-small flex items-center gap-2 text-ink-2">
          <span aria-hidden="true" className="inline-block size-1.5 rounded-full bg-ink-3" />
          {t.privacy}
        </p>
        <ThemeChoice />
      </div>
    </footer>
  );
}
