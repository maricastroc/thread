import Link from "next/link";
import { ImportButton } from "@/components/ImportButton";
import { ArrowIcon } from "@/components/icons";
import { SearchField } from "@/components/SearchField";
import { Setup } from "@/components/Setup";
import { RecordLink } from "@/components/SiteHeader";
import { StoryRow } from "@/components/StoryRow";
import { formatDate, formatDuration, formatMonthYear } from "@/lib/format";
import { t } from "@/lib/i18n";
import { loadVault } from "@/lib/server/data";
import { archiveStats, listRecordings, listStories, themeCounts } from "@/lib/server/repo";
import { buildTimeline } from "@/lib/server/timeline";
import type { RecordingSummary } from "@/lib/types";

function Pending({ recordings }: { recordings: RecordingSummary[] }) {
  const working = recordings.filter((r) => r.stage !== "ready" && !r.failedStage);
  const failed = recordings.filter((r) => r.failedStage);
  if (!working.length && !failed.length) return null;
  return (
    <ul className="mt-10 max-w-3xl divide-y divide-rule border-y border-rule">
      {working.map((r) => (
        <li key={r.id}>
          <Link href={`/recordings/${r.id}`} className="group flex min-h-14 items-center gap-3 py-3">
            <span aria-hidden="true" className="animate-breathe inline-block size-2 shrink-0 rounded-full bg-voice" />
            <span className="flex-1">
              {t.home.inProgress(1)} <span className="text-ink-2">· {formatDate(r.recordedAt)}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-ink-2 transition-colors group-hover:text-ink">
              {t.home.view} <ArrowIcon size={14} />
            </span>
          </Link>
        </li>
      ))}
      {failed.map((r) => (
        <li key={r.id}>
          <Link href={`/recordings/${r.id}`} className="group flex min-h-14 items-center gap-3 py-3">
            <span aria-hidden="true" className="inline-block size-2 shrink-0 rounded-full border-[1.5px] border-voice" />
            <span className="flex-1">
              {t.home.needsAttention(1)} <span className="text-ink-2">· {formatDate(r.recordedAt)}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-ink-2 transition-colors group-hover:text-ink">
              {t.home.view} <ArrowIcon size={14} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function EmptyArchive({ narrator, recordings }: { narrator: string; recordings: RecordingSummary[] }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-8 pb-10 sm:px-6 sm:pt-20">
      <h1 className="t-display max-w-[13ch] text-balance">{t.home.emptyTitle(narrator)}</h1>
      <p className="t-reading mt-8 max-w-[36rem] text-ink-2">{t.home.emptyBody}</p>
      <Pending recordings={recordings} />
      <div className="mt-12 flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:gap-10">
        <RecordLink label={t.home.recordFirst} className="h-14 px-7 text-[1.0625rem]" />
        <ImportButton />
      </div>
    </section>
  );
}

export default async function Home() {
  const vault = await loadVault();
  if (!vault) return <Setup />;

  const stories = listStories(vault.birthYear);
  const recordings = listRecordings();
  if (!stories.length) return <EmptyArchive narrator={vault.narrator} recordings={recordings} />;

  const stats = archiveStats();
  const groups = buildTimeline(stories);
  const themes = themeCounts();

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pt-6 pb-14 sm:px-6 sm:pt-14 sm:pb-20">
        <h1 className="t-display">{vault.narrator}</h1>
        <p className="t-meta mt-5">
          {t.home.stats(stats.stories, formatDuration(stats.storySeconds, "long"), vault.narrator)}
          {stats.firstRecordedAt && (
            <>
              <span aria-hidden="true"> · </span>
              <span className="whitespace-nowrap">{t.home.since(formatMonthYear(stats.firstRecordedAt))}</span>
            </>
          )}
        </p>
        <div className="mt-12 max-w-3xl">
          <SearchField narrator={vault.narrator} size="hero" id="home-search" />
          <p className="t-small mt-3 text-ink-2">{t.search.examples}</p>
        </div>
        <Pending recordings={recordings} />
      </section>

      <section aria-labelledby="timeline-heading" className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 id="timeline-heading" className="visually-hidden">
          {t.home.timeline}
        </h2>
        {groups.map((group) => (
          <section
            key={group.key}
            aria-labelledby={`decade-${group.key}`}
            className="grid border-t border-rule pt-7 md:grid-cols-[11rem_1fr] md:gap-x-8"
          >
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
            <h2 id="themes-heading" className="t-kicker pt-1">
              {t.story.themes}
            </h2>
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
        <div className="flex flex-col items-start gap-6 border-t border-rule pt-10 sm:flex-row sm:items-center sm:gap-10">
          <RecordLink label={t.home.recordAnother} />
          <ImportButton hint={false} />
        </div>
      </section>
    </>
  );
}
