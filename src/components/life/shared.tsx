"use client";

import Link from "next/link";
import { useState } from "react";
import { isSameTrack, useAudio, useAudioState, type Track } from "@/components/audio/AudioProvider";
import { Dock } from "@/components/audio/Dock";
import { Scrubber } from "@/components/audio/Scrubber";
import { TimeReadout } from "@/components/audio/TimeReadout";
import { ArrowIcon, PauseIcon, PlayIcon } from "@/components/icons";
import { formatClock } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { Life, LifeEntity, LifeEvent, LifeStory } from "@/lib/life";

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

export function isCertain(story: LifeStory): boolean {
  return story.certainty === "exact" || story.certainty === "range";
}

export function whenLabel(story: LifeStory): string {
  if (story.certainty === "none") return t.time.undated;
  if (isCertain(story)) return story.label ?? String(story.year);
  if (story.certainty === "stage") return `[${story.label}]`;
  return `[${t.time.circa(String(story.year))}]`;
}

export function ageLabel(story: LifeStory): string | null {
  if (story.age === null || story.certainty === "none" || story.certainty === "stage") return null;
  return isCertain(story) ? t.life.age(story.age) : t.life.aboutAge(story.age);
}

export function eventLabel(event: LifeEvent): string {
  if (event.kind === "age") return t.life.age(event.value);
  if (event.kind === "duration") return t.life.years(event.value);
  return event.year !== null ? t.time.circa(String(event.year)) : t.life.years(event.value);
}

export function certaintyWord(story: LifeStory): string {
  if (story.certainty === "none") return t.life.certainty.none;
  if (story.provenance === "said") return t.life.certainty.said;
  if (story.provenance === "extracted") return t.life.certainty.extracted;
  return t.life.certainty.inferred;
}

export function entityHref(entity: { id: string; kind: "person" | "place" }): string {
  return entity.kind === "person" ? `/people/${entity.id}` : `/places/${entity.id}`;
}

const LIT_WINDOW = 5;

export type Reveal = {
  active: boolean;
  playing: boolean;
  ended: boolean;
  said: Set<string>;
  events: Set<number>;
  litEvents: Set<number>;
  quote: boolean;
  heard: number;
  current: string | null;
};

function unique(values: string[]) {
  return [...new Set(values)];
}

export function useReveal(story: LifeStory | null): Reveal {
  const key = useAudioState((s) => {
    if (!story || !isSameTrack(s.track, trackOf(story))) return "";
    const time = s.ended ? Number.POSITIVE_INFINITY : s.time;
    const said = unique(story.mentions.filter((m) => time >= m.time - 0.3).map((m) => m.entityId));
    const events = story.events.map((e, i) => (time >= e.time - 0.3 ? i : -1)).filter((i) => i >= 0);
    const litEvents = s.playing ? story.events.map((e, i) => (s.time >= e.time - 0.3 && s.time <= e.time + LIT_WINDOW ? i : -1)).filter((i) => i >= 0) : [];
    const quote = story.quote && s.playing && s.time >= story.quote.start - 0.2 && s.time <= story.quote.end ? 1 : 0;
    const started = s.playing || s.ended || s.time > story.start + 0.3 ? 1 : 0;
    const heard = story.mentions.filter((m) => time >= m.time - 0.3).length;
    const latest = s.playing ? story.mentions.filter((m) => s.time >= m.time - 0.3 && s.time <= m.time + LIT_WINDOW).at(-1)?.entityId ?? "" : "";
    return [said.join(","), events.join(","), litEvents.join(","), quote, s.ended ? 1 : 0, s.playing ? 1 : 0, started, heard, latest].join("|");
  });
  if (!key)
    return { active: false, playing: false, ended: false, said: new Set(), events: new Set(), litEvents: new Set(), quote: false, heard: 0, current: null };
  const [said, events, litEvents, quote, ended, playing, started, heard, latest] = key.split("|");
  const set = (value: string) => new Set(value.split(",").filter(Boolean));
  const numbers = (value: string) => new Set(value.split(",").filter(Boolean).map(Number));
  return {
    active: started === "1",
    playing: playing === "1",
    ended: ended === "1",
    said: set(said),
    events: numbers(events),
    litEvents: numbers(litEvents),
    quote: quote === "1",
    heard: Number(heard),
    current: latest || null,
  };
}

export function useProgress(story: LifeStory | null, steps = 60) {
  return useAudioState((s) => {
    if (!story || !isSameTrack(s.track, trackOf(story))) return 0;
    return Math.round(((s.time - story.start) / Math.max(1, story.duration)) * steps) / steps;
  });
}

export function usePlayingStory() {
  return useAudioState((s) => (s.track?.storyId && s.playing ? s.track.storyId : null));
}

export function glyphWidth(duration: number) {
  return Math.round(Math.min(104, Math.max(16, duration * 1.2)));
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
  headingLevel?: "h2" | "h3";
};

export function FragmentOpen({ story, activeEntity, onEntity, onClose, compact, headingLevel = "h2" }: OpenProps) {
  const { play } = useAudio();
  const track = trackOf(story);
  const reveal = useReveal(story);
  const firstAt = (id: string) => story.mentions.find((m) => m.entityId === id)?.time ?? Number.POSITIVE_INFINITY;
  const traces = [...story.people.map((p) => ({ ...p, kind: "person" as const })), ...story.places.map((p) => ({ ...p, kind: "place" as const }))].sort(
    (a, b) => firstAt(a.id) - firstAt(b.id),
  );
  const lang = story.language ?? undefined;
  const Heading = headingLevel;
  const active = traces.find((trace) => trace.id === activeEntity) ?? null;
  const age = ageLabel(story);

  return (
    <div className="animate-rise">
      <Dock id={story.id} />
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="text-[0.9375rem]">
            <span className={isCertain(story) ? "text-ink" : "text-ink-2 italic"}>{whenLabel(story)}</span>
            {age && <span className="text-ink"> · {age}</span>}
            <span className="text-ink-2"> · {certaintyWord(story)}</span>
          </p>
          <Heading className={`${compact ? "t-entry" : "t-heading"} mt-2`} lang={lang}>
            {story.title}
          </Heading>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-[0.9375rem] text-ink-2 hover:bg-ink/[0.05] hover:text-ink"
        >
          {t.life.close}
        </button>
      </div>

      {story.quote && (
        <blockquote
          className={`mt-5 max-w-[40rem] border-l-2 pl-4 font-serif italic transition-colors duration-500 ${compact ? "text-[1.125rem] leading-snug" : "text-[1.375rem] leading-[1.35]"} ${
            reveal.quote ? "border-voice" : "border-transparent"
          }`}
          lang={lang}
        >
          <span aria-hidden="true">“</span>
          {story.quote.text}
          <span aria-hidden="true">”</span>
        </blockquote>
      )}

      <div className="mt-6 flex items-center gap-4">
        <PlayLarge story={story} />
        <Scrubber
          track={track}
          peaks={story.peaks}
          label={t.story.seek}
          height={compact ? 36 : 44}
          className="min-w-0 flex-1"
        />
        <TimeReadout track={track} className="hidden sm:inline" />
      </div>

      {traces.length > 0 && (
        <div className="mt-6">
          <p className="t-small text-ink-2">{t.life.traces}</p>
          <ul className="mt-1 flex flex-wrap gap-x-5">
            {traces.map((trace) => {
              const isLit = reveal.current === trace.id;
              const isActive = activeEntity === trace.id;
              const first = story.mentions.find((m) => m.entityId === trace.id);
              return (
                <li key={trace.id} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`size-2 rounded-full transition-colors duration-300 ${isLit ? "bg-voice" : reveal.said.has(trace.id) ? "bg-ink" : "bg-rule-2"}`}
                  />
                  <button
                    type="button"
                    onClick={() => onEntity(isActive ? null : trace.id)}
                    aria-pressed={isActive}
                    className={`min-h-11 rounded-sm text-[1rem] underline-offset-[0.22em] transition-colors ${
                      isActive ? "text-ink underline decoration-ink" : "text-ink decoration-rule-2 hover:underline"
                    }`}
                    lang={lang}
                  >
                    {trace.name}
                  </button>
                  {first && (
                    <button
                      type="button"
                      onClick={() => play(track, Math.max(story.start, first.time - 1))}
                      className="t-time inline-flex min-h-11 items-center text-ink-2 hover:text-ink"
                      aria-label={t.story.playMoment(formatClock(first.time - story.start))}
                    >
                      {formatClock(first.time - story.start)}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {story.events.length > 0 && (
            <ul className="mt-1 flex flex-wrap gap-x-5">
              {story.events.map((e, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`size-[7px] rotate-45 transition-colors duration-300 ${reveal.litEvents.has(i) ? "bg-voice" : reveal.events.has(i) ? "bg-ink" : "bg-rule-2"}`}
                  />
                  <span className="text-[1rem] whitespace-nowrap tabular-nums">{eventLabel(e)}</span>
                  <button
                    type="button"
                    onClick={() => play(track, Math.max(story.start, e.time - 1))}
                    className="t-small inline-flex min-h-11 items-center text-ink-2 italic hover:text-ink"
                    aria-label={`${t.story.playMoment(formatClock(e.time - story.start))}: ${e.evidence}`}
                    lang={lang}
                  >
                    “{e.evidence}”
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-x-8">
        <Link href={`/stories/${story.id}`} className="inline-flex min-h-11 items-center gap-2 text-[0.9375rem] text-ink-2 hover:text-ink">
          {t.life.read} <ArrowIcon size={14} />
        </Link>
        {active && (
          <Link href={entityHref(active)} className="inline-flex min-h-11 items-center gap-2 text-[0.9375rem] text-ink-2 hover:text-ink" lang={lang}>
            {t.life.everyMoment(active.name)} <ArrowIcon size={14} />
          </Link>
        )}
      </div>
    </div>
  );
}

export function TrailBar({
  entities,
  activeEntity,
  onEntity,
  language,
  limit = 8,
  kinds = ["person", "place"],
}: {
  entities: LifeEntity[];
  activeEntity: string | null;
  onEntity: (id: string | null) => void;
  language: string | null;
  limit?: number;
  kinds?: ("person" | "place")[];
}) {
  const [expanded, setExpanded] = useState<("person" | "place")[]>([]);
  const group = (kind: "person" | "place") => {
    const all = entities.filter((e) => e.kind === kind);
    const open = expanded.includes(kind);
    const list = open ? all : all.filter((e, i) => i < limit || e.id === activeEntity);
    const hidden = all.length - list.length;
    if (!list.length) return null;
    return (
      <div key={kind} className="flex flex-wrap items-baseline gap-x-4">
        <span className="t-kicker w-16 shrink-0">{kind === "person" ? t.nav.people : t.nav.places}</span>
        {list.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => onEntity(activeEntity === e.id ? null : e.id)}
            aria-pressed={activeEntity === e.id}
            lang={language ?? undefined}
            className={`min-h-11 font-serif text-[1.0625rem] underline-offset-[0.22em] transition-colors ${
              activeEntity === e.id ? "text-ink underline decoration-ink" : activeEntity ? "text-ink-3 hover:text-ink" : "text-ink decoration-rule-2 hover:underline"
            }`}
          >
            {e.name}
            <span className="t-time ml-1 text-ink-3">{e.storyIds.length}</span>
          </button>
        ))}
        {(hidden > 0 || open) && all.length > limit && (
          <button
            type="button"
            onClick={() => setExpanded(open ? expanded.filter((k) => k !== kind) : [...expanded, kind])}
            aria-expanded={open}
            className="inline-flex min-h-11 items-center text-[0.9375rem] text-ink-2 underline decoration-rule-2 underline-offset-[0.22em] hover:text-ink"
          >
            {open ? t.life.fewer : t.life.more(hidden)}
          </button>
        )}
      </div>
    );
  };
  return <div>{kinds.map(group)}</div>;
}

export function lifeSpan(life: Life) {
  const years = life.stories.filter((s) => s.from !== null).map((s) => s.from!);
  const start = life.birthYear ?? (years.length ? Math.min(...years) - 2 : life.now - 10);
  return { start, end: life.now };
}

export function gapsOf(life: Life, start: number, end: number, minimum = 8) {
  const reach = new Set<number>();
  for (const s of life.stories) {
    if (s.year === null) continue;
    for (let y = Math.round(s.from ?? s.year); y <= Math.round(s.to ?? s.year); y++) reach.add(y);
  }
  const gaps: { from: number; to: number }[] = [];
  let open: number | null = null;
  for (let y = start; y <= end; y++) {
    if (!reach.has(y)) open ??= y;
    else if (open !== null) {
      if (y - open >= minimum) gaps.push({ from: open, to: y - 1 });
      open = null;
    }
  }
  if (open !== null && end - open + 1 >= minimum) gaps.push({ from: open, to: end });
  return gaps;
}
