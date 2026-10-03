import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Dock } from "@/components/audio/Dock";
import { ArrowIcon } from "@/components/icons";
import { RecordingLive } from "@/components/recording/RecordingLive";
import { RemoveRecording } from "@/components/recording/RemoveRecording";
import { StoryPlayer } from "@/components/story/StoryPlayer";
import { Transcript } from "@/components/story/Transcript";
import { StoryRow } from "@/components/StoryRow";
import { formatDate, formatDuration } from "@/lib/format";
import { t } from "@/lib/i18n";
import { loadVault } from "@/lib/server/data";
import { slicePeaks } from "@/lib/server/peaks";
import { getPeaks, getRecording, getSegments } from "@/lib/server/evidence";
import { factsForStories, storiesOfRecording } from "@/lib/server/interpretation";
import { recordingStatus } from "@/lib/server/status";
import { buildParagraphs } from "@/lib/server/story-view";
import { peaksForStories } from "@/lib/server/representation";

export async function generateMetadata(props: PageProps<"/recordings/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  await loadVault();
  const recording = getRecording(id);
  return { title: recording ? t.recording.title(formatDate(recording.recordedAt)) : t.errors.notFoundTitle };
}

export default async function RecordingPage(props: PageProps<"/recordings/[id]">) {
  const { id } = await props.params;
  const vault = await loadVault();
  if (!vault) redirect("/");
  const recording = getRecording(id);
  if (!recording) notFound();

  if (recording.stage !== "ready" || recording.failedStage) {
    const initial = recordingStatus(id, 0, true)!;
    const playable = recording.failedStage === "organizing" || recording.failedStage === "indexing";
    if (!playable) return <RecordingLive initial={initial} />;
    const lines = getSegments(id);
    const span = recording.duration ?? 0;
    const whole = { recordingId: id, storyId: null, title: t.recording.title(formatDate(recording.recordedAt)), start: 0, end: span, language: recording.language };
    return (
      <>
        <RecordingLive initial={initial} />
        {lines.length > 0 && (
          <section aria-labelledby="fallback-transcript" className="mx-auto max-w-6xl px-4 sm:px-6">
            <Dock id={`recording:${id}`} />
            <StoryPlayer track={whole} peaks={slicePeaks(getPeaks(id), 0, span, 260)} markers={[]} className="sticky top-0 border-y border-rule" />
            <div className="grid pt-8 lg:grid-cols-[4.5rem_minmax(0,38rem)] lg:gap-x-10">
              <div className="hidden lg:block" />
              <h2 id="fallback-transcript" className="t-kicker">
                {t.recording.transcript}
              </h2>
            </div>
            <Transcript track={whole} paragraphs={buildParagraphs(lines, [])} language={recording.language} offset={0} />
          </section>
        )}
      </>
    );
  }

  const duration = recording.duration ?? 0;
  const stories = storiesOfRecording(id, vault.birthYear);
  const segments = getSegments(id);
  const facts = factsForStories(stories.map((s) => s.id));
  const rowPeaks = peaksForStories(stories, 44);
  const peaks = slicePeaks(getPeaks(id), 0, duration, 260);
  const title = t.recording.title(formatDate(recording.recordedAt));
  const track = { recordingId: id, storyId: null, title, start: 0, end: duration, language: recording.language };

  const sections: { story: (typeof stories)[number] | null; from: number; to: number }[] = [];
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
    <article className="mx-auto max-w-6xl px-4 sm:px-6">
      <Dock id={`recording:${id}`} />
      <nav aria-label="Breadcrumb" className="pt-2 sm:pt-4">
        <Link href="/" className="group inline-flex min-h-11 items-center gap-2 text-[0.9375rem] text-ink-2 hover:text-ink">
          <ArrowIcon direction="left" size={14} className="transition-transform group-hover:-translate-x-0.5" />
          {t.story.allStories}
        </Link>
      </nav>

      <header className="grid pt-6 pb-8 sm:pt-10 lg:grid-cols-[4.5rem_minmax(0,1fr)] lg:gap-x-10">
        <div className="hidden lg:block" />
        <div>
          <p className="t-kicker mb-5">{t.recording.kicker}</p>
          <h1 className="t-title">{formatDate(recording.recordedAt)}</h1>
          <p className="t-meta mt-5">
            {formatDuration(duration)}
            <span aria-hidden="true"> · </span>
            {recording.source === "imported" ? t.recording.imported : t.recording.recorded}
          </p>
          {recording.prompt && (
            <p className="mt-6 max-w-[34rem] font-serif text-[1.1875rem] leading-snug text-ink-2 italic">
              {t.record.asked}: {recording.prompt}
            </p>
          )}
          <p className="mt-6 text-[1.0625rem]">{stories.length ? t.recording.holds(stories.length) : t.recording.none}</p>
        </div>
      </header>

      <StoryPlayer
        track={track}
        peaks={peaks}
        markers={stories.map((s) => ({ time: s.start, label: s.title }))}
        className="sticky top-0 border-b border-rule"
      />

      {stories.length > 0 && (
        <section aria-labelledby="stories-heading" className="grid pt-8 pb-6 lg:grid-cols-[4.5rem_minmax(0,1fr)] lg:gap-x-10">
          <div className="hidden lg:block" />
          <div>
            <h2 id="stories-heading" className="t-kicker">
              {t.recording.stories}
            </h2>
            <ol className="relative mt-2 max-w-4xl before:absolute before:top-9 before:bottom-14 before:left-[4px] before:w-px before:bg-rule">
              {stories.map((story) => (
                <StoryRow key={story.id} story={story} peaks={rowPeaks.get(story.id) ?? []} />
              ))}
            </ol>
          </div>
        </section>
      )}

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
              <div className="grid lg:grid-cols-[4.5rem_minmax(0,38rem)] lg:gap-x-10">
                <div className="hidden lg:block" />
                {section.story ? (
                  <h3 className="t-heading" lang={recording.language ?? undefined}>
                    <Link href={`/stories/${section.story.id}`} className="link">
                      {section.story.title}
                    </Link>
                  </h3>
                ) : (
                  <h3 className="t-small text-ink-2">{t.recording.between}</h3>
                )}
              </div>
              <Transcript track={track} paragraphs={paragraphs} language={recording.language} offset={0} />
            </div>
          );
        })}
        <div className="grid lg:grid-cols-[4.5rem_minmax(0,38rem)] lg:gap-x-10">
          <div className="hidden lg:block" />
          <p className="t-small mt-6 text-ink-2">{t.story.transcriptNote}</p>
        </div>
      </section>

      <section className="grid border-t border-rule pt-8 lg:grid-cols-[4.5rem_minmax(0,1fr)] lg:gap-x-10">
        <div className="hidden lg:block" />
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-8">
          <a href={`/api/recordings/${id}/original`} className="inline-flex min-h-11 items-center gap-2 text-[0.9375rem] underline decoration-rule-2 underline-offset-[0.3em] hover:decoration-ink">
            {t.recording.download}
          </a>
          <RemoveRecording id={id} />
        </div>
      </section>
    </article>
  );
}
