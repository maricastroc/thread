import Link from "next/link";
import { PlayButton } from "@/components/audio/PlayButton";
import { whenText } from "@/components/when";
import { formatClock } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { Moment } from "@/lib/types";

function escape(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function Highlighted({ text, words }: { text: string; words: string[] }) {
  if (!words.length) return <>{text}</>;
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(${words.map(escape).join("|")})(?![\\p{L}\\p{N}])`, "giu");
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded-[2px] bg-evidence px-0.5 text-ink">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export function MomentResult({ moment, index }: { moment: Moment; index: number }) {
  const track = {
    recordingId: moment.recordingId,
    storyId: moment.storyId,
    title: moment.storyTitle ?? t.search.unassigned,
    start: moment.storyStart,
    end: moment.storyEnd,
    language: moment.language,
  };
  const href = moment.storyId ? `/stories/${moment.storyId}` : `/recordings/${moment.recordingId}`;
  const clock = formatClock(moment.start - track.start);
  const when = whenText(moment.when);

  return (
    <li className="grid grid-cols-[1.75rem_1fr] gap-x-3 border-t border-rule py-8 sm:grid-cols-[3rem_1fr] sm:gap-x-6">
      <span className="t-time pt-1.5 text-ink-2" aria-hidden="true">
        {String(index + 1).padStart(2, "0")}
      </span>
      <article className="min-w-0">
        <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="t-entry" lang={moment.language ?? undefined}>
            <Link href={href} className="link">
              {moment.storyTitle ?? t.search.unassigned}
            </Link>
          </h2>
          {when && <span className={`text-[0.9375rem] ${moment.when?.provenance === "inferred" ? "text-ink-2 italic" : "text-ink-2"}`}>{when}</span>}
        </header>

        <blockquote className="mt-4 max-w-[40rem] font-serif text-[1.1875rem] leading-[1.6]" lang={moment.language ?? undefined}>
          {moment.before && <span className="text-ink-2">…{moment.before} </span>}
          <span className="text-ink">
            <Highlighted text={moment.text} words={moment.highlight} />
          </span>
          {moment.after && <span className="text-ink-2"> {moment.after}…</span>}
        </blockquote>

        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
          <PlayButton track={track} from={moment.start} size="md" variant="solid" label={t.search.listenFrom(clock)}>
            <span className="text-[1rem] font-medium">{t.search.listenFrom(clock)}</span>
          </PlayButton>
          <Link href={href} className="inline-flex min-h-11 items-center text-[0.9375rem] text-ink-2 underline decoration-rule-2 underline-offset-[0.3em] hover:text-ink hover:decoration-ink">
            {moment.storyId ? t.search.openStory : t.search.openRecording}
          </Link>
        </div>
      </article>
    </li>
  );
}
