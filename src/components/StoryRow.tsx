import Link from "next/link";
import { PlayButton } from "@/components/audio/PlayButton";
import { TimelineDot, WhenLabel } from "@/components/when";
import { WaveSignature } from "@/components/WaveSignature";
import { formatClock } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { StorySummary } from "@/lib/types";

export function StoryRow({
  story,
  peaks,
  showWhen = true,
  context,
}: {
  story: StorySummary;
  peaks: number[];
  showWhen?: boolean;
  context?: string;
}) {
  const track = {
    recordingId: story.recordingId,
    storyId: story.id,
    title: story.title,
    start: story.start,
    end: story.end,
    language: story.language,
  };
  return (
    <li className="group relative grid grid-cols-[1.25rem_1fr] gap-x-3 py-6 sm:grid-cols-[1.25rem_7.5rem_1fr_auto] sm:gap-x-5 sm:py-7">
      <div className="relative z-10 pt-[0.7rem]">
        <TimelineDot when={showWhen ? story.when : null} />
      </div>
      {showWhen && (
        <p
          className={`col-start-2 pt-[0.45rem] text-[0.9375rem] tabular-nums sm:col-start-auto ${
            story.when?.provenance === "inferred" ? "text-ink-2 italic" : "text-ink"
          }`}
        >
          <WhenLabel when={story.when} />
        </p>
      )}
      {!showWhen && <span className="hidden sm:block" />}
      <div className="col-start-2 min-w-0 sm:col-start-auto">
        {context && (
          <p className="t-small mb-1.5 text-ink-2" lang={story.language ?? undefined}>
            {context}
          </p>
        )}
        <h3 className="t-entry" lang={story.language ?? undefined}>
          <Link
            href={`/stories/${story.id}`}
            className="decoration-rule-2 underline-offset-[0.18em] after:absolute after:inset-0 after:content-[''] group-hover:underline"
          >
            {story.title}
          </Link>
        </h3>
        {story.quote && (
          <p className="mt-2 max-w-[40rem] font-serif text-[1.0625rem] leading-[1.45] text-ink-2 italic" lang={story.language ?? undefined}>
            <span aria-hidden="true">“</span>
            {story.quote.text}
            <span aria-hidden="true">”</span>
          </p>
        )}
      </div>
      <div className="relative z-10 col-start-2 mt-4 flex items-center gap-4 sm:col-start-auto sm:mt-0 sm:self-start sm:pt-1">
        <WaveSignature peaks={peaks} height={22} className="text-ink-3 opacity-60 transition-opacity group-hover:opacity-100" />
        <span className="t-time w-10 text-right text-ink-2">
          <span className="visually-hidden">{t.story.listen}, </span>
          {formatClock(story.end - story.start)}
        </span>
        <PlayButton track={track} size="sm" />
      </div>
    </li>
  );
}
