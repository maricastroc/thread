import Link from "next/link";
import { redirect } from "next/navigation";
import { ImportButton } from "@/components/ImportButton";
import { ArrowIcon } from "@/components/icons";
import { Lifeline } from "@/components/life/Lifeline";
import { Setup } from "@/components/Setup";
import { RecordLink } from "@/components/SiteHeader";
import { formatDate, formatDuration } from "@/lib/format";
import { t } from "@/lib/i18n";
import { loadVault } from "@/lib/server/data";
import { listRecordings } from "@/lib/server/evidence";
import { archiveStats, listStories } from "@/lib/server/interpretation";
import { loadLife } from "@/lib/server/representation";
import type { RecordingSummary } from "@/lib/types";

function Pending({ recordings }: { recordings: RecordingSummary[] }) {
  const working = recordings.filter((r) => r.stage !== "ready" && !r.failedStage);
  const failed = recordings.filter((r) => r.failedStage);
  if (!working.length && !failed.length) return null;
  return (
    <ul className="mt-8 max-w-3xl divide-y divide-rule border-y border-rule">
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
            <span aria-hidden="true" className="inline-block size-2 shrink-0 rounded-full border-[1.5px] border-error" />
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

function EmptyArchive({ subject, recordings }: { subject: string; recordings: RecordingSummary[] }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-8 pb-10 sm:px-6 sm:pt-20">
      <h1 className="t-display max-w-[13ch] text-balance">{t.home.emptyTitle(subject)}</h1>
      <p className="t-reading mt-8 max-w-[36rem] text-ink-2">{t.home.emptyBody}</p>
      <Pending recordings={recordings} />
      <div className="mt-12 flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:gap-10">
        <RecordLink label={t.home.recordFirst} className="h-14 px-7 text-[1.0625rem]" />
        <ImportButton />
      </div>
    </section>
  );
}

function NoStoriesYet({ subject, recordings }: { subject: string; recordings: RecordingSummary[] }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-8 pb-10 sm:px-6 sm:pt-20">
      <h1 className="t-display max-w-[14ch] text-balance">{t.home.noStoriesTitle(subject)}</h1>
      <p className="t-reading mt-8 max-w-[36rem] text-ink-2">{t.home.noStoriesBody(recordings.length)}</p>
      <Pending recordings={recordings} />
      <div className="mt-10 flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:gap-10">
        <Link href="/recordings" className="inline-flex min-h-11 items-center gap-2 text-[1.0625rem] underline decoration-rule-2 underline-offset-[0.3em] hover:decoration-ink">
          {t.home.seeRecordings} <ArrowIcon size={16} />
        </Link>
        <RecordLink label={t.home.recordAnother} />
        <ImportButton hint={false} />
      </div>
    </section>
  );
}

export default async function Home(props: PageProps<"/">) {
  const vault = await loadVault();
  if (!vault) return <Setup />;

  const params = await props.searchParams;
  if (params.view === "list") redirect("/stories");

  const stories = listStories(vault.birthYear);
  const recordings = listRecordings();
  if (!recordings.length) return <EmptyArchive subject={vault.subject} recordings={recordings} />;
  if (!stories.length) return <NoStoriesYet subject={vault.subject} recordings={recordings} />;

  const story = typeof params.story === "string" ? params.story : null;
  const trail = typeof params.trail === "string" ? params.trail : null;
  const stats = archiveStats();
  const life = loadLife(vault);
  const kept = new Set(life.stories.filter((s) => s.year !== null).map((s) => s.year!)).size;
  const years = life.now - (life.birthYear ?? life.now) || 1;

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pt-6 pb-6 sm:px-6 sm:pt-12 sm:pb-8">
        <h1 className="t-display">{vault.subject}</h1>
        <p className="t-meta mt-5 max-w-[46rem]">
          {t.life.summary(life.birthYear, stats.stories, formatDuration(stats.storySeconds, "long"), kept, years)}
        </p>
        <Pending recordings={recordings} />
      </section>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Lifeline life={life} initialStory={story} initialTrail={trail} />
        <div className="mt-12 flex flex-col items-start gap-6 border-t border-rule pt-10 sm:flex-row sm:items-center sm:gap-10">
          <RecordLink label={t.home.recordAnother} />
          <ImportButton hint={false} />
        </div>
      </div>
    </>
  );
}
