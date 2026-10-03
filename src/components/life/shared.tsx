"use client";

import Link from "next/link";
import { isSameTrack, useAudio, useAudioState, type Track } from "@/components/audio/AudioProvider";
import { Dock } from "@/components/audio/Dock";
import { Scrubber } from "@/components/audio/Scrubber";
import { TimeReadout } from "@/components/audio/TimeReadout";
import { ArrowIcon, PauseIcon, PlayIcon } from "@/components/icons";
import { formatClock } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { LifeStory } from "@/lib/life";

export function trackOf(story: LifeStory): Track {
  return {
    recordingId: story.recordingId,
    storyId: story.id,
    title: story.title,
    start: story.start,
    end: story.end,
    language: story.language,
  };
}

export function whenLabel(story: LifeStory): string {
  if (story.certainty === "none") return t.time.undated;
  if (story.certainty === "exact" || story.certainty === "range") return story.label ?? String(story.year);
  if (story.certainty === "stage") return `[${story.label}]`;
  return `[c. ${story.year}]`;
}

export function certaintyWord(story: LifeStory): string {
  if (story.certainty === "none") return "not placed in time";
  if (story.provenance === "said") return "said";
  if (story.provenance === "extracted") return "from the words";
  return "inferred";
}

const LIT_WINDOW = 5;

export function useMentionState(story: LifeStory | null) {
  return useAudioState((s) => {
    if (!story || !isSameTrack(s.track, trackOf(story))) return "";
    const lit = story.mentions.filter((m) => s.time >= m.time - 0.3 && s.time <= m.time + LIT_WINDOW).map((m) => m.entityId);
    const said = story.mentions.filter((m) => s.time >= m.time - 0.3).map((m) => m.entityId);
    return `${[...new Set(lit)].join(",")}|${[...new Set(said)].join(",")}`;
  });
}

export function parseMentionState(value: string) {
  const [lit = "", said = ""] = value.split("|");
  return { lit: new Set(lit.split(",").filter(Boolean)), said: new Set(said.split(",").filter(Boolean)) };
}

export function PlayLarge({ story }: { story: LifeStory }) {
  const { play, toggle, store } = useAudio();
  const track = trackOf(story);
  const playing = useAudioState((s) => isSameTrack(s.track, track) && s.playing);
  const onClick = () => {
    const state = store.get();
    if (!isSameTrack(state.track, track) || state.ended) return play(track, track.start);
    toggle();
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${playing ? t.story.pause : t.story.listen}: ${story.title}`}
      className="inline-flex h-12 shrink-0 items-center gap-2.5 rounded-full bg-ink pr-5 pl-4 text-paper transition-[filter,transform] duration-150 hover:brightness-125 active:scale-[0.98]"
    >
      {playing ? <PauseIcon size={16} /> : <PlayIcon size={16} className="translate-x-[1px]" />}
      <span className="text-[0.9375rem] font-medium">{playing ? t.story.pause : t.story.listen}</span>
    </button>
  );
}

type OpenProps = {
  story: LifeStory;
  activeEntity: string | null;
  onEntity: (id: string | null) => void;
  onClose: () => void;
  compact?: boolean;
};

export function FragmentOpen({ story, activeEntity, onEntity, onClose, compact }: OpenProps) {
  const { play } = useAudio();
  const track = trackOf(story);
  const { lit, said } = parseMentionState(useMentionState(story));
  const traces = [...story.people.map((p) => ({ ...p, kind: "person" as const })), ...story.places.map((p) => ({ ...p, kind: "place" as const }))];
  const lang = story.language ?? undefined;

  return (
    <div className="animate-rise">
      <Dock id={story.id} />
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <p className={`text-[0.9375rem] ${story.certainty === "exact" || story.certainty === "range" ? "text-ink" : "text-ink-2 italic"}`}>
            {whenLabel(story)} <span className="not-italic text-ink-2">· {certaintyWord(story)}</span>
          </p>
          <h2 className={`${compact ? "t-entry" : "t-heading"} mt-2`} lang={lang}>
            {story.title}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-10 shrink-0 items-center rounded-full px-3 text-[0.875rem] text-ink-2 hover:bg-ink/[0.05] hover:text-ink"
        >
          Close
        </button>
      </div>

      {story.quote && (
        <blockquote className={`mt-5 max-w-[40rem] font-serif italic ${compact ? "text-[1.125rem] leading-snug" : "text-[1.375rem] leading-[1.35]"}`} lang={lang}>
          “{story.quote.text}”
        </blockquote>
      )}

      <div className="mt-6 flex items-center gap-4">
        <PlayLarge story={story} />
        <Scrubber track={track} peaks={story.peaks} label={t.story.seek} height={compact ? 36 : 44} markers={story.mentions.map((m) => ({ time: m.time, label: m.entityId }))} className="min-w-0 flex-1" />
        <TimeReadout track={track} className="hidden sm:inline" />
      </div>

      {traces.length > 0 && (
        <div className="mt-6">
          <p className="t-small text-ink-2">Traces in this memory</p>
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
            {traces.map((trace) => {
              const isLit = lit.has(trace.id);
              const isActive = activeEntity === trace.id;
              const first = story.mentions.find((m) => m.entityId === trace.id);
              return (
                <li key={trace.id} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`size-2 rounded-full transition-colors duration-300 ${isLit ? "bg-voice" : said.has(trace.id) ? "bg-ink" : "bg-rule-2"}`}
                  />
                  <button
                    type="button"
                    onClick={() => onEntity(isActive ? null : trace.id)}
                    aria-pressed={isActive}
                    className={`min-h-9 rounded-sm text-[1rem] underline-offset-[0.22em] transition-colors ${isActive ? "text-ink underline decoration-ink" : "text-ink hover:underline decoration-rule-2"}`}
                    lang={lang}
                  >
                    {trace.name}
                  </button>
                  {first && (
                    <button
                      type="button"
                      onClick={() => play(track, Math.max(story.start, first.time - 1))}
                      className="t-time text-ink-2 hover:text-ink"
                      aria-label={t.story.playMoment(formatClock(first.time - story.start))}
                    >
                      {formatClock(first.time - story.start)}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Link href={`/stories/${story.id}`} className="mt-6 inline-flex min-h-11 items-center gap-2 text-[0.9375rem] text-ink-2 hover:text-ink">
        Read what was said <ArrowIcon size={14} />
      </Link>
    </div>
  );
}

export function TrailBar({
  entities,
  activeEntity,
  onEntity,
  language,
  limit = 10,
}: {
  entities: { id: string; name: string; kind: "person" | "place"; storyIds: string[] }[];
  activeEntity: string | null;
  onEntity: (id: string | null) => void;
  language: string | null;
  limit?: number;
}) {
  const people = entities.filter((e) => e.kind === "person" && e.storyIds.length > 0).slice(0, limit);
  const places = entities.filter((e) => e.kind === "place" && e.storyIds.length > 0).slice(0, limit);
  const group = (title: string, list: typeof people) => (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <span className="t-kicker w-16 shrink-0">{title}</span>
      {list.map((e) => (
        <button
          key={e.id}
          type="button"
          onClick={() => onEntity(activeEntity === e.id ? null : e.id)}
          aria-pressed={activeEntity === e.id}
          lang={language ?? undefined}
          className={`min-h-9 font-serif text-[1.0625rem] underline-offset-[0.22em] transition-colors ${
            activeEntity === e.id ? "text-ink underline decoration-ink" : activeEntity ? "text-ink-3 hover:text-ink" : "text-ink hover:underline decoration-rule-2"
          }`}
        >
          {e.name}
          <span className="t-time ml-1 text-ink-3">{e.storyIds.length}</span>
        </button>
      ))}
    </div>
  );
  return (
    <div className="space-y-1.5">
      {group("People", people)}
      {group("Places", places)}
    </div>
  );
}

const GLYPH_BAR = 2;
const GLYPH_GAP = 1.5;

export function Glyph({ story, width, height, progress }: { story: LifeStory; width: number; height: number; progress: number }) {
  const count = Math.max(6, Math.floor(width / (GLYPH_BAR + GLYPH_GAP)));
  const step = story.peaks.length / count;
  const bars = Array.from({ length: count }, (_, i) => {
    let max = 0;
    for (let k = Math.floor(i * step); k < Math.floor((i + 1) * step) && k < story.peaks.length; k++) max = Math.max(max, story.peaks[k]);
    return max;
  });
  return (
    <svg width={width} height={height} viewBox={`0 0 ${count * (GLYPH_BAR + GLYPH_GAP)} ${height}`} preserveAspectRatio="none" aria-hidden="true" className="block">
      {bars.map((p, i) => {
        const h = Math.max(2, p * height);
        const played = progress > 0 && i / count < progress;
        return <rect key={i} x={i * (GLYPH_BAR + GLYPH_GAP)} y={height - h} width={GLYPH_BAR} height={h} rx={1} className={played ? "fill-voice" : "fill-current"} />;
      })}
    </svg>
  );
}

