import Link from "next/link";
import { PlayButton } from "@/components/audio/PlayButton";
import { ArrowIcon } from "@/components/icons";
import { whenText } from "@/components/when";
import { formatClock } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { Fact, Segment, StorySummary } from "@/lib/types";

type Props = {
  back: { href: string; label: string };
  lifeline?: React.ReactNode;
  entity: { name: string; relation: string | null; aliases: string[] };
  stories: StorySummary[];
  facts: (Fact & { primary: boolean })[];
  segments: Map<string, Segment>;
  language: string | null;
};

function escape(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function Sentence({ text, evidence }: { text: string; evidence: string | null }) {
  if (!evidence) return <>{text}</>;
  const index = text.toLowerCase().indexOf(evidence.toLowerCase());
  if (index < 0) {
    const parts = text.split(new RegExp(`(${escape(evidence)})`, "i"));
    return <>{parts.map((p, i) => (i % 2 ? <mark key={i} className="rounded-[2px] bg-evidence px-0.5 text-ink">{p}</mark> : <span key={i}>{p}</span>))}</>;
  }
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded-[2px] bg-evidence px-0.5 text-ink">{text.slice(index, index + evidence.length)}</mark>
      {text.slice(index + evidence.length)}
    </>
  );
}

export function EntityMoments({ back, lifeline, entity, stories, facts, segments, language }: Props) {
  const ordered = [...stories].sort((a, b) => (a.when?.yearFrom ?? 9999) - (b.when?.yearFrom ?? 9999) || a.recordedAt.localeCompare(b.recordedAt));
  const momentCount = facts.filter((f) => f.seg !== null).length;
  const lang = language ?? undefined;

  return (
    <article className="mx-auto max-w-6xl px-4 sm:px-6">
      <nav aria-label="Breadcrumb" className="pt-2 sm:pt-4">
        <Link href={back.href} className="group inline-flex min-h-11 items-center gap-2 text-[0.9375rem] text-ink-2 hover:text-ink">
          <ArrowIcon direction="left" size={14} className="transition-transform group-hover:-translate-x-0.5" />
          {back.label}
        </Link>
      </nav>
      <header className="pt-6 pb-8 sm:pt-10">
        <h1 className="t-display" lang={lang}>
          {entity.name}
        </h1>
        <p className="t-meta mt-5">
          {entity.relation && entity.relation.toLowerCase() !== entity.name.toLowerCase() && (
            <>
              <span lang={lang}>{entity.relation}</span>
              <span aria-hidden="true"> · </span>
            </>
          )}
          {t.entities.stories(stories.length)} · {t.entities.moments(momentCount)}
        </p>
        {entity.aliases.length > 0 && (
          <p className="t-small mt-2 text-ink-2">
            {t.entities.alsoCalled} <span lang={lang}>{entity.aliases.join(", ")}</span>
          </p>
        )}
      </header>

      {lifeline && <div className="pb-4">{lifeline}</div>}

      <section aria-labelledby="moments-heading" className="mt-6 border-t border-rule pt-8">
        <h2 id="moments-heading" className="t-heading" lang={lang}>
          {t.entities.momentsOf(entity.name)}
        </h2>
        <div className="mt-6">
          {ordered.map((story) => {
            const own = facts
              .filter((f) => f.storyId === story.id && f.seg !== null && f.start !== null)
              .sort((a, b) => a.start! - b.start!);
            if (!own.length) return null;
            const track = {
              recordingId: story.recordingId,
              storyId: story.id,
              title: story.title,
              start: story.start,
              end: story.end,
              language: story.language,
            };
            const when = whenText(story.when);
            return (
              <section key={story.id} className="grid gap-x-10 border-b border-rule py-8 lg:grid-cols-[minmax(0,18rem)_1fr]">
                <header className="mb-4 lg:mb-0">
                  <h3 className="t-entry" lang={lang}>
                    <Link href={`/stories/${story.id}`} className="link">
                      {story.title}
                    </Link>
                  </h3>
                  {when && <p className={`mt-1 text-[0.9375rem] text-ink-2 ${story.when?.provenance === "inferred" ? "italic" : ""}`}>{when}</p>}
                </header>
                <ol className="space-y-5">
                  {own.map((fact) => {
                    const segment = segments.get(`${fact.recordingId}:${fact.seg}`);
                    const clock = formatClock(fact.start! - story.start);
                    return (
                      <li key={fact.id} className="grid grid-cols-[auto_1fr] items-start gap-x-4">
                        <PlayButton track={track} from={Math.max(story.start, fact.start! - 1.2)} size="sm" label={t.story.playMoment(clock)} />
                        <div>
                          <p className="font-serif text-[1.1875rem] leading-relaxed" lang={lang}>
                            <Sentence text={segment?.text ?? fact.evidence ?? ""} evidence={fact.evidence} />
                          </p>
                          <p className="t-time mt-1 text-ink-2">{clock}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}
        </div>
      </section>
    </article>
  );
}
