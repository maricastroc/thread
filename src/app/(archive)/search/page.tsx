import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MomentResult } from "@/components/search/MomentResult";
import { SearchField } from "@/components/SearchField";
import { t } from "@/lib/i18n";
import { loadVault } from "@/lib/server/data";
import { search } from "@/lib/server/search";

export async function generateMetadata(props: PageProps<"/search">): Promise<Metadata> {
  const { q } = await props.searchParams;
  return { title: typeof q === "string" && q.trim() ? t.search.resultsFor(q.trim()) : t.search.title };
}

export default async function SearchPage(props: PageProps<"/search">) {
  const vault = await loadVault();
  if (!vault) redirect("/");
  const { q } = await props.searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 200) : "";
  const outcome = query ? await search(query, vault.birthYear) : null;

  const sentence = !outcome
    ? null
    : outcome.strength === "strong"
      ? t.search.found(outcome.moments.length, vault.subject)
      : outcome.strength === "weak"
        ? t.search.weak(vault.subject)
        : t.search.none;

  return (
    <section className="mx-auto max-w-6xl px-4 pt-6 pb-10 sm:px-6 sm:pt-12">
      <h1 className="visually-hidden">{query ? t.search.resultsFor(query) : t.search.title}</h1>
      <div className="max-w-3xl">
        <SearchField subject={vault.subject} size="hero" defaultValue={query} autoFocus={!query} id="search-page" />
        {!query && <p className="t-meta mt-4">{t.search.empty}</p>}
      </div>

      {outcome && (
        <div className="mt-12 max-w-4xl">
          <p role="status" className="font-serif text-[clamp(1.375rem,1.15rem+0.9vw,1.875rem)] leading-snug tracking-[-0.01em]">
            {sentence}
          </p>

          {outcome.moments.length > 0 && (
            <ol className="mt-8">
              {outcome.moments.map((moment, i) => (
                <MomentResult key={`${moment.recordingId}-${moment.start}`} moment={moment} index={i} />
              ))}
            </ol>
          )}

          {outcome.strength !== "strong" && (
            <div className="mt-10 max-w-[36rem] border-t border-rule pt-8">
              <p className="text-[1.0625rem] text-ink-2">{t.search.noneHint}</p>
              <Link
                href={{ pathname: "/record", query: { q: query } }}
                className="mt-4 inline-flex h-12 items-center gap-2.5 rounded-full border border-rule-2 px-5 text-[1rem] transition-colors hover:border-ink"
              >
                <span aria-hidden="true" className="size-2 rounded-full bg-current" />
                {t.search.askNextTime}
              </Link>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
