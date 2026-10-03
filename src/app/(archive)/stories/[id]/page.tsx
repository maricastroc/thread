import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Dock } from "@/components/audio/Dock";
import { PlayButton } from "@/components/audio/PlayButton";
import { ArrowIcon } from "@/components/icons";
import { Note } from "@/components/story/Note";
import { RenameTitle } from "@/components/story/RenameTitle";
import { StoryPlayer } from "@/components/story/StoryPlayer";
import { Transcript } from "@/components/story/Transcript";
import { StoryRow } from "@/components/StoryRow";
import { whenText } from "@/components/when";
import { formatClock, formatDate, formatDuration } from "@/lib/format";
import { t } from "@/lib/i18n";
import { loadVault } from "@/lib/server/data";
import { slicePeaks } from "@/lib/server/peaks";
import { getPeaks, getStory, relatedStories, storiesOfRecording } from "@/lib/server/repo";
import { buildParagraphs, entityHref, toNote } from "@/lib/server/story-view";
import { peaksForStories } from "@/lib/server/timeline";
import type { LifeStage, Theme } from "@/lib/types";

export async function generateMetadata(props: PageProps<"/stories/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const vault = await loadVault();
  const data = vault ? getStory(id, vault.birthYear) : null;
  return { title: data?.story.title ?? t.story.notFound };
}

function Section({ title, children, id }: { title: string; children: React.ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="grid gap-y-5 border-t border-rule pt-8 pb-12 lg:grid-cols-[4.5rem_minmax(0,1fr)] lg:gap-x-10">
      <div className="hidden lg:block" />
      <div>
        <h2 id={id} className="t-heading">
          {title}
        </h2>
        <div className="mt-6">{children}</div>
      </div>
    </section>
  );
}

export default async function StoryPage(props: PageProps<"/stories/[id]">) {
  const { id } = await props.params;
  const vault = await loadVault();
  if (!vault) redirect("/");
  const data = getStory(id, vault.birthYear);
  if (!data) notFound();

  const { story, segments, facts, questions } = data;
  const siblings = storiesOfRecording(story.recordingId, vault.birthYear);
  const part = siblings.findIndex((s) => s.id === story.id) + 1;
  const related = relatedStories(story.id, vault.birthYear).filter((r) => r.story.recordingId !== story.recordingId);
  const others = siblings.filter((s) => s.id !== story.id);
  const relatedPeaks = peaksForStories([...others, ...related.map((r) => r.story)], 44);
  const peaks = slicePeaks(getPeaks(story.recordingId), story.start, story.end, 220);
  const paragraphs = buildParagraphs(segments, facts);
  const primary = facts.filter((f) => f.primary);
  const notes = primary.map((f) => toNote(f, entityHref));
  const people = notes.filter((n) => n.kind === "person");
  const places = notes.filter((n) => n.kind === "place");
  const when = notes.filter((n) => n.kind === "time" || n.kind === "life_stage");
  const track = {
    recordingId: story.recordingId,
    storyId: story.id,
    title: story.title,
    start: story.start,
    end: story.end,
    language: story.language,
  };
  const markers = primary
    .filter((f) => f.start !== null && (f.kind === "person" || f.kind === "place"))
    .map((f) => ({ time: f.start!, label: f.value }));
  const lang = story.language ?? undefined;
  const kicker = [whenText(story.when), story.when?.lifeStage && story.when.label !== t.lifeStage[story.when.lifeStage] ? t.lifeStage[story.when.lifeStage as LifeStage] : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="mx-auto max-w-6xl px-4 sm:px-6">
      <Dock id={story.id} />
      <nav aria-label="Breadcrumb" className="pt-2 sm:pt-4">
        <Link href="/" className="group inline-flex min-h-11 items-center gap-2 text-[0.9375rem] text-ink-2 hover:text-ink">
          <ArrowIcon direction="left" size={14} className="transition-transform group-hover:-translate-x-0.5" />
          {t.story.allStories}
        </Link>
      </nav>

      <header className="grid pt-6 pb-10 sm:pt-10 lg:grid-cols-[4.5rem_minmax(0,1fr)] lg:gap-x-10">
        <div className="hidden lg:block" />
        <div>
          {kicker && <p className="t-kicker mb-5">{kicker}</p>}
          <RenameTitle storyId={story.id} title={story.title} titleBy={story.titleBy} language={story.language} />
          <p className="t-meta mt-6">
            {t.story.told(formatDate(story.recordedAt))}
            <span aria-hidden="true"> · </span>
            {formatDuration(story.end - story.start)}
            {siblings.length > 1 && (
              <>
                <span aria-hidden="true"> · </span>
                <Link href={`/recordings/${story.recordingId}`} className="link">
                  {t.story.part(part, siblings.length)}
                </Link>
              </>
            )}
          </p>
          {story.quote && (
            <figure className="mt-10 max-w-[44rem]">
              <blockquote className="t-quote" lang={lang}>
                <span aria-hidden="true" className="-ml-[0.42em]">
                  “
                </span>
                {story.quote.text}
                <span aria-hidden="true">”</span>
              </blockquote>
              <figcaption className="mt-4">
                <PlayButton track={track} from={story.quote.start} size="sm" label={t.story.playMoment(formatClock(story.quote.start - story.start))}>
                  <span className="t-small text-ink-2">{t.story.playMoment(formatClock(story.quote.start - story.start))}</span>
                </PlayButton>
              </figcaption>
            </figure>
          )}
        </div>
      </header>

      <StoryPlayer track={track} peaks={peaks} markers={markers} className="sticky top-0 hidden border-b border-rule lg:block" />

      <section aria-labelledby="transcript-heading" className="pt-6 pb-10">
        <div className="grid lg:grid-cols-[4.5rem_minmax(0,38rem)_minmax(0,1fr)] lg:gap-x-10">
          <div className="hidden lg:block" />
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 id="transcript-heading" className="t-kicker">
              {t.story.transcript}
            </h2>
          </div>
        </div>
        <Transcript track={track} paragraphs={paragraphs} language={story.language} offset={story.start} />
        <div className="grid lg:grid-cols-[4.5rem_minmax(0,38rem)] lg:gap-x-10">
          <div className="hidden lg:block" />
          <p className="t-small mt-6 text-ink-2">{t.story.transcriptNote}</p>
        </div>
      </section>

      <StoryPlayer track={track} peaks={peaks} markers={markers} className="sticky bottom-0 -mx-4 border-t border-rule px-4 pb-[env(safe-area-inset-bottom)] sm:-mx-6 sm:px-6 lg:hidden" />

      {(people.length > 0 || places.length > 0 || when.length > 0 || story.themes.length > 0) && (
        <Section title={t.story.inThisStory} id="in-this-story">
          <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 xl:grid-cols-4">
            {people.length > 0 && (
              <div>
                <h3 className="t-kicker mb-3">{t.story.people}</h3>
                {people.map((n) => (
                  <Note key={n.id} note={n} language={story.language} compact />
                ))}
              </div>
            )}
            {places.length > 0 && (
              <div>
                <h3 className="t-kicker mb-3">{t.story.places}</h3>
                {places.map((n) => (
                  <Note key={n.id} note={n} language={story.language} compact />
                ))}
              </div>
            )}
            {when.length > 0 && (
              <div>
                <h3 className="t-kicker mb-3">{t.story.when}</h3>
                {when.map((n) => (
                  <Note key={n.id} note={n} language={story.language} compact />
                ))}
              </div>
            )}
            {story.themes.length > 0 && (
              <div>
                <h3 className="t-kicker mb-3">{t.story.themes}</h3>
                <ul className="space-y-1.5">
                  {story.themes.map((theme: Theme) => (
                    <li key={theme} className="text-[0.9375rem]">
                      {t.themes[theme]}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <details className="group mt-10 max-w-[38rem] border-t border-rule pt-4">
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 text-[0.9375rem] text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
              <span aria-hidden="true" className="inline-block transition-transform group-open:rotate-90">
                ›
              </span>
              {t.story.legendTitle}
            </summary>
            <dl className="mt-3 space-y-3 text-[0.9375rem]">
              <div className="grid grid-cols-[7rem_1fr] gap-4">
                <dt className="font-medium">{t.provenance.said}</dt>
                <dd className="text-ink-2">{t.story.legend.said}</dd>
              </div>
              <div className="grid grid-cols-[7rem_1fr] gap-4">
                <dt className="font-medium">{t.provenance.extracted}</dt>
                <dd className="text-ink-2">{t.story.legend.extracted}</dd>
              </div>
              <div className="grid grid-cols-[7rem_1fr] gap-4">
                <dt className="italic">[{t.provenance.inferred}]</dt>
                <dd className="text-ink-2">{t.story.legend.inferred}</dd>
              </div>
            </dl>
          </details>
        </Section>
      )}

      {questions.length > 0 && (
        <Section title={t.story.questions} id="questions">
          <ul className="max-w-[38rem] divide-y divide-rule border-y border-rule">
            {questions.map((q) => (
              <li key={q.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <p className="font-serif text-[1.1875rem] leading-snug">{q.text}</p>
                <Link
                  href={{ pathname: "/record", query: { q: q.text } }}
                  className="inline-flex min-h-11 shrink-0 items-center gap-2 text-[0.9375rem] text-ink-2 hover:text-ink"
                >
                  <span aria-hidden="true" className="size-2 rounded-full bg-voice" />
                  {t.story.askThis}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {others.length > 0 && (
        <Section title={t.story.sameRecording} id="same-recording">
          <ol className="max-w-4xl">
            {others.map((s) => (
              <StoryRow key={s.id} story={s} peaks={relatedPeaks.get(s.id) ?? []} />
            ))}
          </ol>
          <Link href={`/recordings/${story.recordingId}`} className="mt-4 inline-flex min-h-11 items-center gap-2 text-[0.9375rem] text-ink-2 hover:text-ink">
            {t.story.wholeRecording} <ArrowIcon size={14} />
          </Link>
        </Section>
      )}

      {related.length > 0 && (
        <Section title={t.story.related} id="related">
          <ol className="max-w-4xl">
            {related.map(({ story: s, shared }) => (
              <StoryRow key={s.id} story={s} peaks={relatedPeaks.get(s.id) ?? []} context={t.story.relatedBecause(shared.join(", "))} />
            ))}
          </ol>
        </Section>
      )}
    </article>
  );
}
