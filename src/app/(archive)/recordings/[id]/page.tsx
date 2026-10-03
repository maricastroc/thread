import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Dock } from "@/components/audio/Dock";
import { ArrowIcon } from "@/components/icons";
import { ImportButton } from "@/components/ImportButton";
import { RecordingLive } from "@/components/recording/RecordingLive";
import { RemoveRecording } from "@/components/recording/RemoveRecording";
import { OutcomeLabel } from "@/components/recordings/Outcome";
import { RecordLink } from "@/components/SiteHeader";
import { StoryPlayer } from "@/components/story/StoryPlayer";
import { Transcript } from "@/components/story/Transcript";
import { StoryRow } from "@/components/StoryRow";
import { formatDate, formatDuration, languageName, sameDay } from "@/lib/format";
import { t } from "@/lib/i18n";
import { loadVault } from "@/lib/server/data";
import { getPeaks, getRecording, getSegments } from "@/lib/server/evidence";
import { entitiesOnlyIn, factsForStories, storiesOfRecording } from "@/lib/server/interpretation";
import { slicePeaks } from "@/lib/server/peaks";
import { peaksForStories } from "@/lib/server/representation";
import { recordingStatus } from "@/lib/server/status";
import { buildParagraphs } from "@/lib/server/story-view";
import { outcomeOf } from "@/lib/sources";
import type { Segment, StorySummary } from "@/lib/types";

export async function generateMetadata(props: PageProps<"/recordings/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  await loadVault();
  const recording = getRecording(id);
  return { title: recording ? t.recording.title(formatDate(recording.recordedAt)) : t.errors.notFoundTitle };
}

function Back() {
  return (
    <nav aria-label="Breadcrumb" className="pt-2 sm:pt-4">
      <Link href="/recordings" className="group inline-flex min-h-11 items-center gap-2 text-[0.9375rem] text-ink-2 hover:text-ink">
        <ArrowIcon direction="left" size={14} className="transition-transform group-hover:-translate-x-0.5" />
        {t.recording.back}
      </Link>
    </nav>
  );
}

function Column({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`grid lg:grid-cols-[4.5rem_minmax(0,1fr)] lg:gap-x-10 ${className}`}>
      <div className="hidden lg:block" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function WholeTranscript({
  recordingId,
  title,
  duration,
  language,
  segments,
  stories,
}: {
  recordingId: string;
  title: string;
  duration: number;
  language: string | null;
  segments: Segment[];
  stories: StorySummary[];
}) {
  const facts = factsForStories(stories.map((s) => s.id));
  const track = { recordingId, storyId: null, title, start: 0, end: duration, language };
  const sections: { story: StorySummary | null; from: number; to: number }[] = [];
  let cursor = 0;
  for (const story of stories) {
    const first = segments.findIndex((s) => s.start >= story.start - 0.01);
    const last = segments.findLastIndex((s) => s.end <= story.end + 0.01);
    if (first > cursor) sections.push({ story: null, from: cursor, to: first - 1 });
    if (first >= 0 && last >= first) sections.push({ story, from: first, to: last });
    cursor = Math.max(cursor, last + 1);
  }
  if (cursor < segments.length) sections.push({ story: null, from: cursor, to: segments.length - 1 });

  return (
    <section aria-labelledby="whole-transcript" className="border-t border-rule pt-8 pb-10">
      <div className="grid lg:grid-cols-[4.5rem_minmax(0,38rem)] lg:gap-x-10">
        <div className="hidden lg:block" />
        <h2 id="whole-transcript" className="t-kicker mb-2">
          {t.recording.transcript}
        </h2>
      </div>
      {sections.map((section, i) => {
        const own = section.story ? facts.get(section.story.id) ?? [] : [];
        const paragraphs = buildParagraphs(segments.slice(section.from, section.to + 1), own);
        return (
          <div key={i} className="pt-6">
            {stories.length > 0 && (
              <div className="grid lg:grid-cols-[4.5rem_minmax(0,38rem)] lg:gap-x-10">
                <div className="hidden lg:block" />
                {section.story ? (
                  <h3 className="t-heading" lang={language ?? undefined}>
                    <Link href={`/stories/${section.story.id}`} className="link">
                      {section.story.title}
                    </Link>
                  </h3>
                ) : (
                  <h3 className="t-small text-ink-2">{t.recording.between}</h3>
                )}
              </div>
            )}
            <Transcript track={track} paragraphs={paragraphs} language={language} offset={0} />
          </div>
        );
      })}
      <div className="grid lg:grid-cols-[4.5rem_minmax(0,38rem)] lg:gap-x-10">
        <div className="hidden lg:block" />
        <p className="t-small mt-6 text-ink-2">{t.story.transcriptNote}</p>
      </div>
    </section>
  );
}

export default async function RecordingPage(props: PageProps<"/recordings/[id]">) {
  const { id } = await props.params;
  const vault = await loadVault();
  if (!vault) redirect("/");
  const recording = getRecording(id);
  if (!recording) notFound();

  const segments = getSegments(id);
  const stories = storiesOfRecording(id, vault.birthYear);
  const outcome = outcomeOf({ stage: recording.stage, failedStage: recording.failedStage, segments: segments.length, stories: stories.length });
  const duration = recording.duration ?? 0;
  const title = t.recording.title(formatDate(recording.recordedAt));
  const only = entitiesOnlyIn(id);
  const removeMessage = t.recording.removeConfirm(vault.subject, stories.length, only.people, only.places);

  if (outcome.kind === "working" || outcome.kind === "failed") {
    const initial = recordingStatus(id, 0, true)!;
    const playable = outcome.kind === "failed" && outcome.transcript;
    return (
      <>
        <RecordingLive initial={initial} removeMessage={removeMessage} />
        {playable && (
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Dock id={`recording:${id}`} />
            <StoryPlayer
              track={{ recordingId: id, storyId: null, title, start: 0, end: duration, language: recording.language }}
              peaks={slicePeaks(getPeaks(id), 0, duration, 260)}
              markers={[]}
              className="sticky top-0 border-y border-rule"
            />
            <WholeTranscript recordingId={id} title={title} duration={duration} language={recording.language} segments={segments} stories={[]} />
          </div>
        )}
      </>
    );
  }

  const language = segments.length ? languageName(recording.language) : null;
  const meta = [
    formatDuration(duration),
    recording.source === "imported" ? t.recording.imported : t.recording.recorded,
    language,
    sameDay(recording.recordedAt, recording.createdAt) ? null : t.recordings.added(formatDate(recording.createdAt)),
  ].filter(Boolean);
  const rowPeaks = peaksForStories(stories, 44);

  return (
    <article className="mx-auto max-w-6xl px-4 sm:px-6">
      <Dock id={`recording:${id}`} />
      <Back />

      <header className="pt-6 pb-8 sm:pt-10">
        <Column>
          <p className="t-kicker mb-5">{t.recording.kicker}</p>
          <h1 className="t-title">{formatDate(recording.recordedAt)}</h1>
          <p className="t-meta mt-5">{meta.join(" · ")}</p>
          {recording.originalName && recording.source === "imported" && <p className="t-small mt-1 break-words text-ink-3">{recording.originalName}</p>}
          {recording.prompt && (
            <p className="mt-6 max-w-[34rem] font-serif text-[1.1875rem] leading-snug text-ink-2 italic">
              {t.record.asked}: {recording.prompt}
            </p>
          )}
        </Column>
      </header>

      <StoryPlayer
        track={{ recordingId: id, storyId: null, title, start: 0, end: duration, language: recording.language }}
        peaks={slicePeaks(getPeaks(id), 0, duration, 260)}
        markers={stories.map((s) => ({ time: s.start, label: s.title }))}
        className="sticky top-0 border-b border-rule"
      />

      <section aria-labelledby="found-heading" className="pt-8 pb-8">
        <Column>
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <h2 id="found-heading" className="t-kicker">
              {t.recording.found}
            </h2>
            <OutcomeLabel outcome={outcome} />
          </div>
          {outcome.kind === "stories" ? (
            <>
              <p className="mt-4 text-[1.0625rem]">{t.recording.holds(stories.length)}</p>
              <ol className="relative mt-2 max-w-4xl before:absolute before:top-9 before:bottom-14 before:left-[4px] before:w-px before:bg-rule">
                {stories.map((story) => (
                  <StoryRow key={story.id} story={story} peaks={rowPeaks.get(story.id) ?? []} />
                ))}
              </ol>
              <p className="mt-2 text-[0.9375rem] text-ink-2">
                {t.recording.inLife(vault.subject)}{" "}
                <Link href={{ pathname: "/", query: { story: stories[0].id } }} className="link text-ink">
                  {t.story.inLife(vault.subject)}
                </Link>
              </p>
            </>
          ) : (
            <div className="mt-4 max-w-[40rem]">
              <p className="t-heading">{outcome.kind === "no-speech" ? t.recording.noSpeechTitle : t.recording.noStoriesTitle}</p>
              <p className="t-reading mt-3 text-ink-2">
                {outcome.kind === "no-speech" ? t.recording.noSpeechBody(vault.subject) : t.recording.noStoriesBody(vault.subject)}
              </p>
            </div>
          )}
        </Column>
      </section>

      {segments.length > 0 && (
        <WholeTranscript recordingId={id} title={title} duration={duration} language={recording.language} segments={segments} stories={stories} />
      )}

      <section aria-labelledby="next-heading" className="border-t border-rule pt-8">
        <Column>
          <h2 id="next-heading" className="t-kicker">
            {t.recording.next}
          </h2>
          <div className="mt-4 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-10">
            <RecordLink label={t.home.recordAnother} />
            <ImportButton hint={false} />
          </div>
          <div className="mt-10 flex flex-col items-start gap-4 border-t border-rule pt-6 sm:flex-row sm:items-start sm:gap-8">
            <a href={`/api/recordings/${id}/original`} className="inline-flex min-h-11 items-center gap-2 text-[0.9375rem] underline decoration-rule-2 underline-offset-[0.3em] hover:decoration-ink">
              {t.recording.download}
            </a>
            <RemoveRecording id={id} message={removeMessage} />
          </div>
        </Column>
      </section>
    </article>
  );
}
