import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { StoryRow } from "@/components/StoryRow";
import { t } from "@/lib/i18n";
import { loadVault } from "@/lib/server/data";
import { listStories, themeCounts } from "@/lib/server/interpretation";
import { buildTimeline } from "@/lib/server/representation";
import type { StorySummary } from "@/lib/types";

export const metadata: Metadata = { title: t.stories.title };

function ListView({ stories }: { stories: StorySummary[] }) {
  const groups = buildTimeline(stories);
  const themes = themeCounts();
  return (
    <section aria-labelledby="timeline-heading">
      <h2 id="timeline-heading" className="visually-hidden">
        {t.home.timeline}
      </h2>
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`decade-${group.key}`} className="grid border-t border-rule pt-7 md:grid-cols-[11rem_1fr] md:gap-x-8">
          <div className="md:sticky md:top-6 md:self-start">
            <h3 id={`decade-${group.key}`} className="font-serif text-[2.25rem] leading-none tracking-[-0.02em] md:text-[2.75rem]">
              {group.decade ? t.time.decade(group.decade) : t.home.undated}
            </h3>
            {!group.decade && <p className="t-small mt-2 max-w-[12rem] text-ink-2">{t.home.undatedNote}</p>}
          </div>
          <ol className="relative mt-2 pb-8 before:absolute before:top-9 before:bottom-14 before:left-[4px] before:w-px before:bg-rule md:mt-0">
            {group.entries.map((entry) => (
              <StoryRow key={entry.story.id} story={entry.story} peaks={entry.peaks} showWhen={group.decade !== null || !!entry.story.when} />
            ))}
          </ol>
        </section>
      ))}
      {themes.length > 0 && (
        <section aria-labelledby="themes-heading" className="grid border-t border-rule py-8 md:grid-cols-[11rem_1fr] md:gap-x-8">
          <h3 id="themes-heading" className="t-kicker pt-1">
            {t.story.themes}
          </h3>
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 md:mt-0">
            {themes.map(({ theme, count }) => (
              <li key={theme}>
                <Link href={`/themes/${theme}`} className="link font-serif text-[1.25rem]">
                  {t.themes[theme]}
                </Link>
                <span className="t-time ml-1.5 text-ink-2">{count}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
export default async function StoriesPage() {
  const vault = await loadVault();
  if (!vault) redirect("/");
  const stories = listStories(vault.birthYear);
  const count = stories.length;
  return (
    <section className="mx-auto max-w-6xl px-4 pt-6 pb-10 sm:px-6 sm:pt-12">
      <h1 className="t-display">{t.stories.title}</h1>
      <p className="t-meta mt-5 mb-10 max-w-[40rem]">
        {t.stories.intro(vault.subject)} <span className="text-ink">{t.stories.count(count)}</span>
      </p>
      {count > 0 ? (
        <ListView stories={stories} />
      ) : (
        <p className="text-[1.0625rem] text-ink-2">
          {t.home.noStoriesTitle(vault.subject)}{" "}
          <Link href="/recordings" className="link">
            {t.home.seeRecordings}
          </Link>
        </p>
      )}
    </section>
  );
}
