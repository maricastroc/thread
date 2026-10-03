"use client";

import Link from "next/link";
import { Fragment as Group, useEffect, useRef, useState } from "react";
import { isSameTrack, useAudio, useAudioState } from "@/components/audio/AudioProvider";
import { Dock } from "@/components/audio/Dock";
import { Scrubber } from "@/components/audio/Scrubber";
import { TimeReadout } from "@/components/audio/TimeReadout";
import { ArrowIcon, PauseIcon, PlayIcon } from "@/components/icons";
import { formatClock } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { Life, LifeEntity, LifeStory } from "@/lib/life";
import { STAGE_SPANS } from "@/lib/life";
import { Bars, Rhythm } from "./glyphs";
import {
  FragmentOpen,
  TrailBar,
  ageLabel,
  certaintyWord,
  entityHref,
  eventLabel,
  gapsOf,
  glyphWidth,
  isCertain,
  lifeSpan,
  trackOf,
  usePlayingStory,
  useProgress,
  useReveal,
  whenLabel,
  type Reveal,
} from "./shared";

const ROW_H = 34;
const NEAR_H = 30;
const TOP_SPACE = 40;
const NAMES_H = 40;
const PLAYER_H = 56;
const THREAD_GAP = 40;
const LANE_H = 17;
const BUTTON = 52;
const MAX_ROWS = 6;
const IDLE_SCALE = 0.68;

type Placed = { story: LifeStory; x: number; w: number; row: number };
type Cluster = { ids: string[]; left: number; right: number; from: number; to: number; x: number };
type Target = { key: string; x: number; y: number; year: number };
type Linked = Map<string, { names: string[]; lit: boolean }>;

type Props = {
  life: Life;
  initialStory?: string | null;
  initialTrail?: string | null;
  trailKinds?: ("person" | "place")[];
  showTrailBar?: boolean;
  trailBarFirst?: boolean;
  syncUrl?: boolean;
  onTrailChange?: (id: string | null) => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const estimate = (text: string) => Math.ceil(text.length * 6.9) + 6;

function pack<T extends { x: number; w: number }>(items: T[], lines: number, gap: number): (T & { line: number })[] {
  const taken: { x: number; w: number }[][] = Array.from({ length: lines }, () => []);
  const fits = (line: number, x: number, w: number) => taken[line].every((p) => x + w + gap <= p.x || x >= p.x + p.w + gap);
  return items.map((item) => {
    const line = taken.findIndex((_, l) => fits(l, item.x, item.w));
    if (line >= 0) taken[line].push({ x: item.x, w: item.w });
    return { ...item, line };
  });
}

type FragmentProps = { story: LifeStory; width: number; near: boolean; progress: number; heard?: string; rest: boolean; latest: boolean };

function Fragment({ story, width, near, progress, heard, rest, latest }: FragmentProps) {
  return (
    <span className="relative block" style={{ width, height: ROW_H - 4 }}>
      <span
        className="absolute inset-x-0 bottom-[6px] block origin-bottom transition-transform duration-300 ease-[var(--ease-calm)]"
        style={{ transform: `scaleY(${near ? 1 : IDLE_SCALE})` }}
      >
        <Bars story={story} width={width} height={NEAR_H - 4} progress={progress} heard={heard} rest={rest && !near} />
      </span>
      <span className="absolute inset-x-0 bottom-0 block">
        <Rhythm story={story} width={width} height={4} progress={progress} />
      </span>
      {latest && <span aria-hidden="true" className="absolute -bottom-px -left-2 size-1.5 rounded-full bg-ink-3" />}
    </span>
  );
}

export function Lifeline({
  life,
  initialStory = null,
  initialTrail = null,
  trailKinds = ["person", "place"],
  showTrailBar = true,
  trailBarFirst = false,
  syncUrl = true,
  onTrailChange,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(initialStory);
  const [trail, setTrailState] = useState<string | null>(initialTrail);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const setTrail = (id: string | null) => {
    setTrailState(id);
    onTrailChange?.(id);
  };

  useEffect(() => {
    if (!syncUrl) return;
    const url = new URL(window.location.href);
    if (openId) url.searchParams.set("story", openId);
    else url.searchParams.delete("story");
    if (trail) url.searchParams.set("trail", trail);
    else url.searchParams.delete("trail");
    window.history.replaceState(window.history.state, "", url);
  }, [openId, trail, syncUrl]);

  const open = life.stories.find((s) => s.id === openId) ?? null;
  const reveal = useReveal(open);
  const language = life.stories[0]?.language ?? null;
  const trailEntity = trail ? (life.entities.find((e) => e.id === trail) ?? null) : null;

  const shared: Shared = {
    life,
    open,
    openId,
    setOpenId: (id) => {
      setHoverId(null);
      setOpenId(id);
    },
    hoverId,
    setHoverId,
    trail,
    trailEntity,
    setTrail,
    reveal,
    language,
  };

  const bar = showTrailBar && life.entities.some((e) => trailKinds.includes(e.kind)) && (
    <div className={trailBarFirst ? "mb-8 border-b border-rule pb-5" : "mt-8 border-t border-rule pt-5"}>
      {!trailBarFirst && <p className="t-small mb-1 text-ink-2">{t.life.through}</p>}
      <TrailBar entities={life.entities} activeEntity={trail} onEntity={setTrail} language={language} kinds={trailKinds} limit={trailBarFirst ? 40 : 8} />
    </div>
  );

  return (
    <section aria-label={t.life.label(life.subject)}>
      {trailBarFirst && bar}
      <div className="hidden md:block">
        <Horizontal {...shared} />
      </div>
      <div className="md:hidden">
        <Vertical {...shared} />
      </div>
      {!trailBarFirst && bar}
    </section>
  );
}

type Shared = {
  life: Life;
  open: LifeStory | null;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  hoverId: string | null;
  setHoverId: (id: string | null) => void;
  trail: string | null;
  trailEntity: LifeEntity | null;
  setTrail: (id: string | null) => void;
  reveal: Reveal;
  language: string | null;
};

function linksOf(life: Life, open: LifeStory | null, reveal: Reveal): Linked {
  const map: Linked = new Map();
  if (!open) return map;
  for (const id of reveal.said) {
    const entity = life.entities.find((e) => e.id === id);
    if (!entity) continue;
    for (const storyId of entity.storyIds) {
      if (storyId === open.id) continue;
      const current = map.get(storyId) ?? { names: [], lit: false };
      if (!current.names.includes(entity.name)) current.names.push(entity.name);
      current.lit = current.lit || reveal.current === id;
      map.set(storyId, current);
    }
  }
  return map;
}

function TrailSummary({
  entity,
  stories,
  onOpen,
  onClear,
  language,
}: {
  entity: LifeEntity;
  stories: LifeStory[];
  onOpen: (id: string) => void;
  onClear: () => void;
  language: string | null;
}) {
  const years = stories.filter((s) => s.year !== null).map((s) => s.year!);
  return (
    <div className="animate-rise">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <p className="flex items-baseline gap-3">
          <span aria-hidden="true" className="size-2 translate-y-[-2px] rounded-full bg-voice" />
          <span className="t-heading" lang={language ?? undefined}>
            {entity.name}
          </span>
          <span className="t-meta">
            {years.length ? t.life.trail(Math.min(...years), Math.max(...years), stories.length) : t.life.trailUndated(stories.length)}
          </span>
        </p>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex min-h-11 items-center rounded-full px-3 text-[0.9375rem] text-ink-2 hover:bg-ink/[0.05] hover:text-ink"
        >
          {t.life.clearTrail}
        </button>
      </div>
      <StoryList stories={stories} onOpen={onOpen} />
      <Link
        href={entityHref(entity)}
        className="mt-3 inline-flex min-h-11 items-center gap-2 text-[0.9375rem] text-ink-2 hover:text-ink"
        lang={language ?? undefined}
      >
        {t.life.everyMoment(entity.name)} <ArrowIcon size={14} />
      </Link>
    </div>
  );
}

function StoryList({ stories, onOpen }: { stories: LifeStory[]; onOpen: (id: string) => void }) {
  return (
    <ol className="mt-4 grid gap-x-10 sm:grid-cols-2">
      {stories.map((s) => (
        <li key={s.id}>
          <button type="button" onClick={() => onOpen(s.id)} className="group flex min-h-11 w-full items-baseline gap-4 py-1.5 text-left">
            <span className={`w-20 shrink-0 text-[0.9375rem] tabular-nums ${isCertain(s) ? "text-ink" : "text-ink-2 italic"}`}>{whenLabel(s)}</span>
            <span className="font-serif text-[1.125rem] leading-snug decoration-rule-2 underline-offset-[0.2em] group-hover:underline" lang={s.language ?? undefined}>
              {s.title}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function PeriodSummary({ from, to, stories, onOpen, onClear }: { from: number; to: number; stories: LifeStory[]; onOpen: (id: string) => void; onClear: () => void }) {
  return (
    <div className="animate-rise">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <p className="t-heading">{t.life.period(from, to, stories.length)}</p>
        <button type="button" onClick={onClear} className="inline-flex min-h-11 items-center rounded-full px-3 text-[0.9375rem] text-ink-2 hover:bg-ink/[0.05] hover:text-ink">
          {t.life.clearTrail}
        </button>
      </div>
      <StoryList stories={stories} onOpen={onOpen} />
    </div>
  );
}

function Invitations({ life, start, end }: { life: Life; start: number; end: number }) {
  const heardAny = useAudioState((s) => life.stories.some((story) => s.heard[story.id]?.includes("1")));
  const gaps = gapsOf(life, start, end)
    .sort((a, b) => b.to - b.from - (a.to - a.from))
    .slice(0, 2)
    .sort((a, b) => a.from - b.from);
  return (
    <div className="grid gap-8 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <p className="max-w-[34rem] font-serif text-[1.25rem] leading-snug text-ink-2">
        {t.life.hint(life.subject)}
        {heardAny && ` ${t.life.heardHint}`}
      </p>
      {gaps.length > 0 && (
        <ul className="space-y-1">
          {gaps.map((g) => (
            <li key={g.from} className="text-[0.9375rem]">
              <span className="text-ink-2">{t.life.gapAsk(g.from, g.to)} </span>
              <Link
                href={{
                  pathname: "/record",
                  query: { q: t.life.gapQuestion(g.from, g.to) },
                }}
                className="link inline-flex min-h-11 items-center"
              >
                {t.life.askAbout}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InlinePlayer({ story, width }: { story: LifeStory; width: number }) {
  const { play, toggle, store } = useAudio();
  const track = trackOf(story);
  const playing = useAudioState((s) => isSameTrack(s.track, track) && s.playing);
  const onClick = () => {
    const state = store.get();
    if (!isSameTrack(state.track, track) || state.ended) return play(track, track.start);
    toggle();
  };
  return (
    <div className="flex items-center gap-3" style={{ width }}>
      <button
        type="button"
        onClick={onClick}
        aria-label={`${playing ? t.story.pause : t.story.listen}: ${story.title}`}
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-paper transition-[background-color,transform] hover:bg-[color-mix(in_oklab,var(--text),var(--canvas)_16%)] active:scale-95"
      >
        {playing ? <PauseIcon size={14} /> : <PlayIcon size={14} className="translate-x-[1px]" />}
      </button>
      <Scrubber track={track} peaks={story.peaks} label={t.story.seek} height={40} className="min-w-0 flex-1" />
    </div>
  );
}

type PanelProps = {
  life: Life;
  story: LifeStory;
  reveal: Reveal;
  trail: string | null;
  setTrail: (id: string | null) => void;
  onFocusEntity: (id: string | null) => void;
  onClose: () => void;
};

function MemoryPanel({ life, story, reveal, trail, setTrail, onFocusEntity, onClose }: PanelProps) {
  const { play } = useAudio();
  const track = trackOf(story);
  const lang = story.language ?? undefined;
  const age = ageLabel(story);
  const traces = story.mentions
    .map((m) => ({
      ...m,
      entity: life.entities.find((e) => e.id === m.entityId),
    }))
    .filter((m, i, all) => m.entity && all.findIndex((x) => x.entityId === m.entityId) === i);
  const everything = linksOf(life, story, {
    ...reveal,
    said: new Set(story.mentions.map((m) => m.entityId)),
  });
  const reach = [
    story.year,
    ...[...everything.keys()].map((id) => life.stories.find((s) => s.id === id)?.year ?? null),
    ...story.events.flatMap((e) => (e.anchored && e.year !== null ? [e.year] : [])),
  ].filter((y): y is number => typeof y === "number");

  return (
    <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <Dock id={story.id} />
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-6">
          <p className="text-[0.9375rem]">
            <span className={isCertain(story) ? "text-ink" : "text-ink-2 italic"}>{whenLabel(story)}</span>
            {age && <span className="text-ink"> · {age}</span>}
            <span className="text-ink-2"> · {certaintyWord(story)}</span>
          </p>
          <button
            type="button"
            onClick={onClose}
            className="-mt-2 inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-[0.9375rem] text-ink-2 hover:bg-ink/[0.05] hover:text-ink lg:hidden"
          >
            {t.life.close}
          </button>
        </div>
        <h2 className="t-heading mt-2" lang={lang}>
          {story.title}
        </h2>
        {story.quote && (
          <blockquote
            className={`mt-4 max-w-[40rem] border-l-2 pl-4 font-serif text-[1.3125rem] leading-[1.38] italic transition-colors duration-500 ${
              reveal.quote ? "border-voice text-ink" : reveal.active ? "border-rule text-ink-2" : "border-transparent text-ink"
            }`}
            lang={lang}
          >
            <span aria-hidden="true">“</span>
            {story.quote.text}
            <span aria-hidden="true">”</span>
          </blockquote>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
          <TimeReadout track={track} />
          <Link href={`/stories/${story.id}`} className="inline-flex min-h-11 items-center gap-2 text-[0.9375rem] text-ink-2 hover:text-ink">
            {t.life.read} <ArrowIcon size={14} />
          </Link>
        </div>
        <div aria-live="polite">
          {reveal.ended && (
            <div className="animate-rise mt-6 max-w-[40rem] border-t border-rule pt-5">
              {reach.length > 1 && Math.min(...reach) !== Math.max(...reach) && (
                <p className="font-serif text-[1.1875rem] leading-snug">{t.life.reach(Math.min(...reach), Math.max(...reach), everything.size)}</p>
              )}
              {story.questions.slice(0, 1).map((q) => (
                <div key={q} className="mt-4">
                  <p className="t-small text-ink-2">{t.story.questions}</p>
                  <p className="mt-0.5 text-[1rem] leading-snug">{q}</p>
                  <Link href={{ pathname: "/record", query: { q } }} className="link inline-flex min-h-11 items-center text-[0.9375rem]">
                    {t.search.askNextTime}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="min-w-0 lg:border-l lg:border-rule lg:pl-8">
        <div className="flex items-baseline justify-between gap-4">
          <p className="t-small text-ink-2">{reveal.ended ? t.life.traceTitle : t.life.traces}</p>
          <button
            type="button"
            onClick={onClose}
            className="-mt-2 -mr-3 hidden min-h-11 items-center rounded-full px-3 text-[0.9375rem] text-ink-2 hover:bg-ink/[0.05] hover:text-ink lg:inline-flex"
          >
            {t.life.close}
          </button>
        </div>
        <ul className="mt-1 space-y-0.5" onMouseLeave={() => onFocusEntity(null)}>
          {traces.map((m) => {
            const isSaid = reveal.said.has(m.entityId);
            const isLit = reveal.current === m.entityId;
            const isActive = trail === m.entityId;
            return (
              <li key={m.entityId} className={`flex items-center gap-2.5 transition-colors duration-500 ${reveal.active && !isSaid ? "text-ink-3" : "text-ink"}`}>
                <span
                  aria-hidden="true"
                  className={`size-2 shrink-0 rounded-full transition-colors duration-300 ${isLit ? "bg-voice" : isSaid ? "bg-revealed" : reveal.active ? "bg-unrevealed" : "border border-ink-3"}`}
                />
                <button
                  type="button"
                  onClick={() => setTrail(isActive ? null : m.entityId)}
                  onMouseEnter={() => onFocusEntity(m.entityId)}
                  onFocus={() => onFocusEntity(m.entityId)}
                  onBlur={() => onFocusEntity(null)}
                  aria-pressed={isActive}
                  className={`min-h-9 text-[1rem] underline-offset-[0.22em] ${isActive ? "underline decoration-ink" : "decoration-rule-2 hover:underline"}`}
                  lang={lang}
                >
                  {m.entity!.name}
                </button>
                <span className="t-small text-ink-3">{m.kind === "person" ? (m.entity!.relation ?? t.life.kindPerson) : t.provenance.kinds.place}</span>
                <button
                  type="button"
                  onClick={() => play(track, Math.max(story.start, m.time - 1))}
                  aria-label={t.story.playMoment(formatClock(m.time - story.start))}
                  className="t-time ml-auto inline-flex min-h-9 items-center text-ink-2 hover:text-ink"
                >
                  {formatClock(m.time - story.start)}
                </button>
              </li>
            );
          })}
          {story.events.map((e, i) => {
            const isRevealed = reveal.events.has(i);
            const isLit = reveal.litEvents.has(i);
            return (
              <li key={`e${i}`} className={`flex items-center gap-2.5 transition-colors duration-500 ${reveal.active && !isRevealed ? "text-ink-3" : "text-ink"}`}>
                <span
                  aria-hidden="true"
                  className={`size-[7px] shrink-0 rotate-45 transition-colors duration-300 ${isLit ? "bg-voice" : isRevealed ? "bg-revealed" : reveal.active ? "bg-unrevealed" : "border border-ink-3"}`}
                />
                <span className="text-[1rem] whitespace-nowrap tabular-nums">{eventLabel(e)}</span>
                <span className="t-small min-w-0 text-ink-3 italic" lang={lang}>
                  “{e.evidence}”
                </span>
                <button
                  type="button"
                  onClick={() => play(track, Math.max(story.start, e.time - 1))}
                  aria-label={t.story.playMoment(formatClock(e.time - story.start))}
                  className="t-time ml-auto inline-flex min-h-9 shrink-0 items-center text-ink-2 hover:text-ink"
                >
                  {formatClock(e.time - story.start)}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Horizontal(props: Shared) {
  const { life, open, openId, setOpenId, hoverId, setHoverId, trail, trailEntity, setTrail, reveal, language } = props;
  const frame = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1100);
  const [focusHover, setFocusHover] = useState<string | null>(null);
  const [period, setPeriod] = useState<{ from: number; to: number } | null>(null);
  const playingId = usePlayingStory();
  const progressOf = useProgress(open);
  const heard = useAudioState((s) => s.heard);
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!openId) return;
    const timer = window.setTimeout(() => {
      const box = panel.current?.getBoundingClientRect();
      const top = frame.current?.getBoundingClientRect().top;
      if (!box || top === undefined || box.width === 0) return;
      const overflow = box.top + Math.min(box.height, 340) - window.innerHeight + 24;
      if (overflow <= 0) return;
      const by = Math.max(overflow, top - 24);
      window.scrollBy({ top: by, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }, 540);
    return () => window.clearTimeout(timer);
  }, [openId]);

  const { start, end } = lifeSpan(life);
  const x = (year: number) => ((year - start) / (end - start)) * width;
  const center = (year: number) => x(year + 0.5);
  const dated = life.stories.filter((s) => s.year !== null);
  const undated = life.stories.filter((s) => s.year === null);

  const { placed, clusters } = (() => {
    const rows: { right: number }[][] = [];
    const result: Placed[] = [];
    const extra: { story: LifeStory; x: number; w: number }[] = [];
    for (const story of [...dated].sort((a, b) => a.year! - b.year! || a.recordedAt.localeCompare(b.recordedAt))) {
      const w = glyphWidth(story.duration);
      const left = Math.min(width - w, Math.max(0, center(story.year!) - w / 2));
      let row = 0;
      while (rows[row]?.some((r) => left < r.right + 8)) row++;
      if (row >= MAX_ROWS && story.id !== openId) {
        extra.push({ story, x: left, w });
        continue;
      }
      rows[row] = [...(rows[row] ?? []), { right: left + w }];
      result.push({ story, x: left, w, row });
    }
    const groups: Cluster[] = [];
    for (const o of extra.sort((a, b) => a.x - b.x)) {
      const last = groups[groups.length - 1];
      if (last && o.x <= last.right + 24) {
        last.ids.push(o.story.id);
        last.right = Math.max(last.right, o.x + o.w);
        last.from = Math.min(last.from, o.story.year!);
        last.to = Math.max(last.to, o.story.year!);
        last.x = (last.left + last.right) / 2;
      } else {
        groups.push({ ids: [o.story.id], left: o.x, right: o.x + o.w, from: o.story.year!, to: o.story.year!, x: o.x + o.w / 2 });
      }
    }
    return { placed: result, clusters: groups };
  })();

  const opened = open && open.year !== null ? open : null;
  const maxRow = Math.max(0, ...placed.map((p) => p.row));
  const rowsTop = opened ? NAMES_H + PLAYER_H + THREAD_GAP : TOP_SPACE;
  const axisY = rowsTop + (maxRow + 1) * ROW_H + 8;
  const topOf = (row: number) => axisY - 8 - (row + 1) * ROW_H + 4;

  const stages = life.birthYear
    ? (Object.entries(STAGE_SPANS) as [keyof typeof STAGE_SPANS, [number, number]][])
        .map(([stage, [a, b]]) => ({
          stage,
          from: life.birthYear! + a,
          to: Math.min(end + 1, life.birthYear! + b + 1),
        }))
        .filter((s) => s.from < end)
    : [];
  const covered = new Set(dated.map((s) => s.year!));
  const gaps = gapsOf(life, start, end);
  const decades: number[] = [];
  for (let d = Math.ceil(start / 10) * 10; d <= end; d += 10) decades.push(d);

  const anchor = opened ? (placed.find((p) => p.story.id === opened.id) ?? null) : null;
  const playerWidth = Math.min(560, Math.max(320, width * 0.42));
  const playerLeft = anchor ? clamp(anchor.x + anchor.w / 2 - playerWidth / 2, 0, width - playerWidth) : 0;
  const waveLeft = playerLeft + BUTTON;
  const waveWidth = playerWidth - BUTTON;
  const waveTop = NAMES_H + 8;
  const waveBottom = waveTop + 40;
  const xAt = (time: number) => (opened ? waveLeft + clamp((time - opened.start) / Math.max(1, opened.duration), 0, 1) * waveWidth : 0);
  const openX = opened ? center(opened.year!) : 0;
  const anchorX = anchor ? anchor.x + anchor.w / 2 : 0;

  const firsts = new Map<string, number>();
  if (opened) for (const m of opened.mentions) if (!firsts.has(m.entityId)) firsts.set(m.entityId, m.time);
  const clusterY = (row: number) => topOf(row) - 22;
  const clusterTop = clusterY(MAX_ROWS - 1);
  const targetsOf = (storyIds: string[], except: string | null): Target[] => {
    const own = placed
      .filter((p) => p.story.id !== except && storyIds.includes(p.story.id))
      .map((p) => ({ key: p.story.id, x: p.x + p.w / 2, y: topOf(p.row) + 3, year: p.story.year! }));
    const hidden = clusters
      .filter((c) => c.ids.some((id) => id !== except && storyIds.includes(id)))
      .map((c) => ({ key: `cluster-${c.left}`, x: c.x, y: clusterTop + 18, year: (c.from + c.to) / 2 }));
    return [...own, ...hidden];
  };
  const threads = [...firsts.entries()].flatMap(([id, time]) => {
    const entity = life.entities.find((e) => e.id === id);
    if (!opened || !entity || !reveal.said.has(id)) return [];
    return [{ id, entity, x: xAt(time), lit: reveal.current === id, targets: targetsOf(entity.storyIds, opened.id) }];
  });
  const focus = focusHover ?? (trail && firsts.has(trail) && reveal.said.has(trail) ? trail : null);
  const focusStories = focus ? new Set(life.entities.find((e) => e.id === focus)?.storyIds ?? []) : null;
  const linked = linksOf(life, open, reveal);

  const names = pack(
    [...firsts.entries()].flatMap(([id, time]) => {
      const entity = life.entities.find((e) => e.id === id);
      if (!entity) return [];
      const w = estimate(entity.name);
      return [{ id, name: entity.name, w, x: Math.min(xAt(time) - 1, width - w) }];
    }),
    2,
    10,
  ).filter((n) => n.line >= 0 && reveal.said.has(n.id));

  const laneAll = opened
    ? pack(
        opened.events.flatMap((e, i) => {
          if (e.kind === "offset" && e.anchored && e.year !== null) {
            const text = `${eventLabel(e)} · “${e.evidence}”`;
            const w = estimate(text);
            return [{ i, text, w, x: clamp(center(e.year) - w / 2, 0, width - w) }];
          }
          if (e.kind === "duration") {
            const text = `${eventLabel(e)} · “${e.evidence}”`;
            const w = estimate(text);
            return [{ i, text, w, x: clamp(openX - w / 2, 0, width - w) }];
          }
          return [];
        }),
        2,
        14,
      )
    : [];
  const lane = laneAll.filter((item) => item.line >= 0 && reveal.events.has(item.i));
  const laneLines = laneAll.length ? Math.max(0, ...laneAll.map((item) => item.line)) + 1 : 0;
  const below = laneLines ? laneLines * LANE_H + 8 : 0;
  const stageY = axisY + 46 + below;
  const height = stageY + 46;

  const ageIndex = opened ? opened.events.findIndex((e) => e.kind === "age" && e.year !== null) : -1;
  const ageEvent = opened && ageIndex >= 0 && reveal.events.has(ageIndex) ? opened.events[ageIndex] : null;
  const ageYear = ageEvent?.year ?? null;
  const ageLit = ageIndex >= 0 && reveal.litEvents.has(ageIndex);
  const ageStage = ageYear !== null && life.birthYear ? (stages.find((s) => ageYear >= s.from && ageYear < s.to) ?? null) : null;
  const ageText = ageEvent ? eventLabel(ageEvent) : "";
  const ageX =
    ageYear !== null
      ? Math.max(center(ageYear) - estimate(ageText) / 2, ageStage ? x(ageStage.from) + 6 + estimate(t.lifeStage[ageStage.stage]) + 8 : 0)
      : 0;

  const trailSet = trailEntity ? new Set(trailEntity.storyIds) : null;
  const chain = trailSet && !open ? placed.filter((p) => trailSet.has(p.story.id)).sort((a, b) => a.x - b.x) : [];
  const trailStories = trailEntity ? life.stories.filter((s) => trailEntity.storyIds.includes(s.id)) : [];

  const recede = open && !reveal.active ? 0.4 : 0.22;
  const dimFor = (s: LifeStory) => {
    if (open) {
      if (s.id === open.id) return false;
      if (focusStories) return !focusStories.has(s.id);
      return !linked.has(s.id);
    }
    if (period) return s.year === null || s.year < period.from || s.year > period.to;
    if (trailSet) return !trailSet.has(s.id);
    return false;
  };
  const periodStories = period
    ? life.stories.filter((s) => s.year !== null && s.year >= period.from && s.year <= period.to).sort((a, b) => a.year! - b.year!)
    : [];

  const threadPath = (ox: number, tx: number, ty: number) => {
    const oy = waveBottom + 12;
    const dy = ty - oy;
    return `M ${ox} ${oy} C ${ox} ${oy + dy * 0.62}, ${tx} ${ty - dy * 0.55}, ${tx} ${ty}`;
  };
  const visibleTargets = (th: { id: string; lit: boolean; targets: Target[] }) => {
    if (th.lit || focus === th.id || !opened) return th.targets;
    const nearest = [...th.targets].sort((a, b) => Math.abs(a.year - opened.year!) - Math.abs(b.year - opened.year!) || Math.abs(a.x - anchorX) - Math.abs(b.x - anchorX));
    return nearest.slice(0, reveal.ended ? 3 : 1);
  };
  const threadStyle = (th: { id: string; lit: boolean }) => {
    if (focus && th.id !== focus) return { cls: "stroke-unrevealed", width: 1 };
    if (th.lit) return { cls: "stroke-voice", width: 1.5 };
    if (focus === th.id) return { cls: "stroke-ink", width: 1.2 };
    return { cls: "stroke-revealed", width: 1 };
  };
  const lastHeard = new Map<string, number>();
  if (opened) opened.mentions.slice(0, reveal.heard).forEach((m, i) => lastHeard.set(m.entityId, i));

  return (
    <div onKeyDown={(e) => e.key === "Escape" && open && setOpenId(null)}>
      <div ref={frame} className="relative transition-[height] duration-500" style={{ height }}>
        <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
          {stages.map((s) => {
            const lit = ageStage?.stage === s.stage;
            return (
              <g key={s.stage}>
                <line
                  x1={x(s.from) + 1}
                  x2={x(s.to) - 1}
                  y1={stageY}
                  y2={stageY}
                  className={`transition-[stroke] duration-500 ${lit ? (ageLit ? "stroke-voice" : "stroke-ink") : "stroke-rule-2"}`}
                  strokeWidth={lit ? 2 : 1}
                />
                <line x1={x(s.from) + 1} x2={x(s.from) + 1} y1={stageY - 4} y2={stageY + 4} className="stroke-rule-2" />
              </g>
            );
          })}
          <line x1={0} x2={width} y1={axisY} y2={axisY} className="stroke-axis" />
          {gaps.map((g) => (
            <line key={g.from} x1={x(g.from)} x2={x(g.to + 1)} y1={axisY} y2={axisY} className="stroke-paper" strokeWidth={2} strokeDasharray="1 5" />
          ))}
          {[...covered].map((y) => (
            <line key={y} x1={x(y) + 0.5} x2={x(y + 1) - 0.5} y1={axisY} y2={axisY} className="stroke-ink" strokeWidth={2.5} strokeLinecap="round" />
          ))}
          {decades.map((d) => (
            <line key={d} x1={x(d)} x2={x(d)} y1={axisY - 4} y2={axisY + 4} className="stroke-axis" />
          ))}

          {placed.map((p) => {
            const s = p.story;
            const dim = dimFor(s);
            const certain = isCertain(s);
            const cx = p.x + p.w / 2;
            const ax = center(s.year!);
            const isOpen = opened?.id === s.id;
            return (
              <g key={s.id} opacity={dim ? recede : 1} className="transition-opacity duration-500">
                {s.from !== null && s.to !== null && s.from !== s.to && (
                  <rect
                    x={x(s.from)}
                    y={axisY - 3}
                    width={Math.max(3, x(s.to + 1) - x(s.from))}
                    height={6}
                    rx={3}
                    className={s.certainty === "stage" ? "fill-ink/[0.05]" : "fill-ink/[0.12]"}
                  />
                )}
                {!isOpen && (
                  <line
                    x1={cx}
                    x2={ax}
                    y1={topOf(p.row) + ROW_H - 4}
                    y2={axisY}
                    className={playingId === s.id ? "stroke-voice" : "stroke-rule-2"}
                    strokeDasharray={certain ? undefined : s.certainty === "approximate" ? "2 3" : "1 3"}
                  />
                )}
                <circle cx={ax} cy={axisY} r={isOpen ? 4.5 : 3.5} className={certain ? "fill-ink" : "fill-paper stroke-ink"} strokeWidth={1.2} />
              </g>
            );
          })}

          {opened && anchor && (
            <g>
              <line
                x1={anchorX}
                x2={openX}
                y1={waveBottom + 10}
                y2={axisY}
                className="stroke-voice"
                strokeWidth={1.25}
                strokeDasharray={isCertain(opened) ? undefined : "3 3"}
              />
              {opened.mentions.slice(0, reveal.heard).map((m, i) => {
                const lit = reveal.current === m.entityId && lastHeard.get(m.entityId) === i;
                const faded = focus && m.entityId !== focus;
                return (
                  <circle
                    key={`${m.entityId}-${i}`}
                    cx={xAt(m.time)}
                    cy={waveBottom + 10}
                    r={lit ? 2.75 : 2}
                    className={`animate-appear ${lit ? "fill-voice" : faded ? "fill-unrevealed" : "fill-revealed"}`}
                  />
                );
              })}
              {threads.flatMap((th) =>
                visibleTargets(th).map((target) => {
                  const style = threadStyle(th);
                  return (
                    <path
                      key={`${th.id}-${target.key}`}
                      d={threadPath(th.x, target.x, target.y)}
                      pathLength={1}
                      className={`animate-draw fill-none transition-[stroke] duration-500 ${style.cls}`}
                      strokeWidth={style.width}
                    />
                  );
                }),
              )}
              {opened.events.map((e, i) => {
                if (!reveal.events.has(i)) return null;
                const lit = reveal.litEvents.has(i);
                const tone = lit ? "stroke-voice" : "stroke-revealed";
                if (e.kind === "offset" && e.anchored && e.year !== null) {
                  const b = center(e.year);
                  return (
                    <g key={i} className="animate-appear">
                      <path
                        d={`M ${openX} ${axisY - 2} Q ${(openX + b) / 2} ${axisY - 13} ${b} ${axisY - 2}`}
                        className={`fill-none ${tone}`}
                        strokeDasharray="2 2"
                      />
                      <circle cx={b} cy={axisY} r={4} className={`fill-paper ${tone}`} strokeWidth={1.5} />
                    </g>
                  );
                }
                return null;
              })}
            </g>
          )}

          {chain.length > 1 &&
            chain.slice(1).map((p, i) => {
              const a = chain[i];
              const ax = a.x + a.w / 2;
              const bx = p.x + p.w / 2;
              const ay = topOf(a.row) + 2;
              const by = topOf(p.row) + 2;
              const lift = Math.min(40 + maxRow * 4, Math.abs(bx - ax) * 0.22 + 14);
              return (
                <path
                  key={p.story.id}
                  d={`M ${ax} ${ay} C ${ax} ${Math.min(ay, by) - lift}, ${bx} ${Math.min(ay, by) - lift}, ${bx} ${by}`}
                  className="animate-rise fill-none stroke-voice"
                  strokeWidth={1.25}
                />
              );
            })}
        </svg>

        {placed.map((p) => {
          const s = p.story;
          const dim = dimFor(s);
          const isOpen = open?.id === s.id;
          const near = isOpen || hoverId === s.id || playingId === s.id;
          const lit = !!linked.get(s.id)?.lit && !dim;
          return (
            <Group key={s.id}>
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : s.id)}
                onMouseEnter={() => setHoverId(s.id)}
                onMouseLeave={() => setHoverId(null)}
                onFocus={() => setHoverId(s.id)}
                onBlur={() => setHoverId(null)}
                aria-pressed={isOpen}
                aria-label={`${s.title}. ${whenLabel(s)}${ageLabel(s) ? `, ${ageLabel(s)}` : ""}. ${formatClock(s.duration)}`}
                className={`absolute rounded-[2px] transition-[opacity,color] duration-500 ${isOpen || lit ? "text-voice" : "text-ink"} ${near ? "z-10" : ""}`}
                style={{
                  left: p.x,
                  top: topOf(p.row),
                  width: p.w,
                  height: ROW_H - 4,
                  opacity: dim ? recede + 0.02 : 1,
                }}
              >
                <Fragment
                  story={s}
                  width={p.w}
                  near={near && !isOpen}
                  progress={isOpen ? progressOf : 0}
                  heard={heard[s.id]}
                  rest={!isOpen && !lit}
                  latest={!open && s.recordingId === life.latestRecordingId}
                />
              </button>
              {isOpen && opened && (
                <div className="animate-rise absolute z-20" style={{ left: playerLeft, top: NAMES_H }}>
                  <InlinePlayer story={opened} width={playerWidth} />
                </div>
              )}
            </Group>
          );
        })}

        {clusters.map((c) => {
          const marked = c.ids.some((id) => linked.has(id) || (!open && trailSet?.has(id)));
          const dim = open ? !c.ids.some((id) => linked.has(id)) : period ? c.to < period.from || c.from > period.to : trailSet ? !marked : false;
          return (
            <button
              key={c.left}
              type="button"
              onClick={() => {
                setOpenId(null);
                setPeriod({ from: c.from, to: c.to });
              }}
              aria-label={t.life.morePeriod(c.ids.length, c.from, c.to)}
              className="absolute z-10 inline-flex h-6 -translate-x-1/2 items-center gap-1 rounded-full px-2 text-[0.8125rem] text-ink-2 tabular-nums transition-[opacity,background-color] duration-500 hover:bg-ink/[0.05] hover:text-ink"
              style={{ left: c.x, top: clusterTop, opacity: dim ? recede + 0.1 : 1 }}
            >
              {marked && <span aria-hidden="true" className="size-1.5 rounded-full bg-voice" />}+{c.ids.length}
            </button>
          );
        })}

        {names.map((n) => (
          <span
            key={n.id}
            aria-hidden="true"
            onMouseEnter={() => setFocusHover(n.id)}
            onMouseLeave={() => setFocusHover(null)}
            className={`animate-appear absolute z-20 cursor-default text-[0.8125rem] leading-4 whitespace-nowrap transition-colors duration-500 ${
              reveal.current === n.id ? "text-voice" : focus === n.id ? "text-ink" : focus ? "text-ink-3" : "text-ink-2"
            }`}
            style={{ left: n.x, top: NAMES_H - 19 - n.line * LANE_H }}
            lang={language ?? undefined}
          >
            {n.name}
          </span>
        ))}

        {lane.map((item) => (
          <span
            key={item.i}
            aria-hidden="true"
            className={`animate-appear absolute text-[0.8125rem] leading-4 whitespace-nowrap transition-colors duration-500 ${reveal.litEvents.has(item.i) ? "text-voice" : "text-ink-2"}`}
            style={{ left: item.x, top: axisY + 30 + item.line * LANE_H }}
            lang={language ?? undefined}
          >
            {item.text}
          </span>
        ))}

        {ageEvent && (
          <span
            aria-hidden="true"
            className={`animate-appear absolute text-[0.8125rem] leading-4 font-medium whitespace-nowrap transition-colors duration-500 ${ageLit ? "text-voice" : "text-ink"}`}
            style={{ left: ageX, top: stageY + 6 }}
          >
            {ageText}
          </span>
        )}

        {hoverId &&
          hoverId !== openId &&
          (() => {
            const p = placed.find((q) => q.story.id === hoverId);
            if (!p) return null;
            const age = ageLabel(p.story);
            const link = linked.get(p.story.id);
            return (
              <div
                role="presentation"
                className="pointer-events-none absolute z-30 w-max max-w-[17rem] -translate-x-1/2 -translate-y-full rounded-[3px] bg-paper-raised px-2.5 py-1.5 shadow-[0_0_0_1px_var(--line),0_8px_24px_-16px_rgb(0_0_0/0.35)]"
                style={{
                  left: Math.min(width - 130, Math.max(130, p.x + p.w / 2)),
                  top: topOf(p.row) - 6,
                }}
              >
                <p className="font-serif text-[1rem] leading-snug" lang={p.story.language ?? undefined}>
                  {p.story.title}
                </p>
                <p className="t-small text-ink-2">
                  {whenLabel(p.story)}
                  {age ? ` · ${age}` : ""} · {formatClock(p.story.duration)}
                </p>
                {link && (
                  <p className="t-small text-voice" lang={language ?? undefined}>
                    {link.names.join(" · ")}
                  </p>
                )}
              </div>
            );
          })()}

        {trailEntity && chain.length > 0 && !hoverId && (
          <div className="animate-rise pointer-events-none absolute flex items-baseline gap-2" style={{ left: Math.min(width - 260, chain[0].x), top: 4 }}>
            <span aria-hidden="true" className="size-1.5 translate-y-[-2px] rounded-full bg-voice" />
            <span className="font-serif text-[1.0625rem] leading-none" lang={language ?? undefined}>
              {trailEntity.name}
            </span>
          </div>
        )}

        {gaps
          .filter((g) => x(g.to + 1) - x(g.from) >= 160)
          .map((g) => (
            <span
              key={g.from}
              className={`t-small absolute text-center text-ink-3 italic transition-opacity duration-500 ${open ? "opacity-0" : ""}`}
              style={{
                left: x(g.from),
                width: x(g.to + 1) - x(g.from),
                top: axisY - 24,
              }}
            >
              {t.life.gap(g.to - g.from + 1)}
            </span>
          ))}
        {decades.map((d) => (
          <span
            key={d}
            className="t-time absolute text-ink-2"
            style={{
              left: x(d),
              top: axisY + 12,
              transform: "translateX(-50%)",
            }}
          >
            {d}
          </span>
        ))}
        {stages.map((s) => (
          <span
            key={s.stage}
            className={`t-small absolute pl-1.5 transition-colors duration-500 ${ageStage?.stage === s.stage ? "text-ink" : "text-ink-2"}`}
            style={{ left: x(s.from), top: stageY + 6 }}
          >
            {t.lifeStage[s.stage]}
          </span>
        ))}
        <span className="t-small absolute text-ink-2" style={{ left: 0, top: stageY + 26 }}>
          {t.life.born} {life.birthYear ?? ""}
        </span>
        <span className="t-small absolute flex items-center gap-1.5 text-ink-2" style={{ right: 0, top: stageY + 26 }}>
          {life.latestRecordingId && (
            <>
              <span aria-hidden="true" className="size-1.5 rounded-full bg-ink-3" /> {t.life.latest} ·
            </>
          )}{" "}
          {t.life.now(end)}
        </span>
      </div>

      <div className="mx-auto max-w-6xl">
        <div ref={panel} className="min-h-[12rem] border-t border-axis pt-6">
          {open ? (
            opened ? (
              <MemoryPanel
                life={life}
                story={opened}
                reveal={reveal}
                trail={trail}
                setTrail={setTrail}
                onFocusEntity={setFocusHover}
                onClose={() => setOpenId(null)}
              />
            ) : (
              <FragmentOpen story={open} activeEntity={trail} onEntity={setTrail} onClose={() => setOpenId(null)} />
            )
          ) : period ? (
            <PeriodSummary
              from={period.from}
              to={period.to}
              stories={periodStories}
              onOpen={(id) => {
                setPeriod(null);
                setOpenId(id);
              }}
              onClear={() => setPeriod(null)}
            />
          ) : trailEntity ? (
            <TrailSummary entity={trailEntity} stories={trailStories} onOpen={setOpenId} onClear={() => setTrail(null)} language={language} />
          ) : (
            <Invitations life={life} start={start} end={end} />
          )}
        </div>

        {undated.length > 0 && (
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-rule pt-4">
            <span className="t-small text-ink-2">{t.life.unplaced}</span>
            {undated.map((s) => {
              const link = linked.get(s.id);
              const dim = trailSet && !open ? !trailSet.has(s.id) : open ? s.id !== open.id && !link : false;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setOpenId(openId === s.id ? null : s.id)}
                  aria-pressed={openId === s.id}
                  className={`flex min-h-11 items-center gap-3 rounded-sm transition-opacity ${openId === s.id ? "text-ink" : "text-ink-2 hover:text-ink"}`}
                  style={{ opacity: dim ? 0.3 : 1 }}
                >
                  <Rhythm story={s} width={glyphWidth(s.duration)} height={3} />
                  <span className="font-serif text-[1rem]" lang={s.language ?? undefined}>
                    {s.title}
                  </span>
                  {link && (
                    <span className={`t-small ${link.lit ? "text-voice" : "text-ink-2"}`} lang={language ?? undefined}>
                      {link.names.join(" · ")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Vertical(props: Shared) {
  const { life, open, setOpenId, trail, trailEntity, setTrail, reveal, language } = props;
  const playingId = usePlayingStory();
  const progress = useProgress(open);
  const heard = useAudioState((s) => s.heard);
  const { start, end } = lifeSpan(life);
  const dated = [...life.stories.filter((s) => s.year !== null)].sort((a, b) => a.year! - b.year! || a.recordedAt.localeCompare(b.recordedAt));
  const undated = life.stories.filter((s) => s.year === null);
  const trailSet = trailEntity ? new Set(trailEntity.storyIds) : null;
  const linked = linksOf(life, open, reveal);
  const list = useRef<HTMLDivElement>(null);
  const initialOpen = useRef(open?.id ?? null);

  useEffect(() => {
    const id = initialOpen.current;
    const el = id ? list.current?.querySelector<HTMLElement>(`[data-story="${id}"]`) : null;
    if (el && el.offsetParent !== null) el.scrollIntoView({ block: "start" });
  }, []);

  const items: ({ kind: "story"; story: LifeStory } | { kind: "gap"; from: number; to: number; years: number })[] = [];
  let previous = start;
  for (const story of dated) {
    const years = story.year! - previous;
    if (years >= 8)
      items.push({
        kind: "gap",
        from: previous + 1,
        to: story.year! - 1,
        years: years - 1,
      });
    items.push({ kind: "story", story });
    previous = story.year!;
  }
  if (end - previous >= 8)
    items.push({
      kind: "gap",
      from: previous + 1,
      to: end,
      years: end - previous,
    });

  const row = (story: LifeStory) => {
    const isOpen = open?.id === story.id;
    const link = linked.get(story.id);
    const dim = trailSet && !open ? !trailSet.has(story.id) : open ? !isOpen && !link : false;
    const age = ageLabel(story);
    const marked = (trailSet?.has(story.id) && !open) || !!link;
    const w = Math.min(150, glyphWidth(story.duration) * 1.4);
    return (
      <li key={story.id} data-story={story.id} className="relative scroll-mt-6 pl-7 transition-opacity duration-500" style={{ opacity: dim ? 0.38 : 1 }}>
        <span
          aria-hidden="true"
          className={`absolute top-[0.85rem] left-[1px] size-[9px] rounded-full border-[1.5px] transition-colors duration-500 ${
            isOpen || link?.lit ? "border-voice bg-voice" : marked ? "border-ink bg-ink" : isCertain(story) ? "border-ink bg-ink" : "border-ink bg-paper"
          }`}
        />
        {isOpen ? (
          <div className="py-3">
            <FragmentOpen story={story} activeEntity={trail} onEntity={setTrail} onClose={() => setOpenId(null)} compact headingLevel="h3" />
          </div>
        ) : (
          <button type="button" onClick={() => setOpenId(story.id)} className="group block w-full py-2.5 text-left">
            <span className="flex flex-wrap items-baseline gap-x-2 text-[0.875rem]">
              <span className={isCertain(story) ? "text-ink" : "text-ink-2 italic"}>{whenLabel(story)}</span>
              {age && <span className="text-ink-2">· {age}</span>}
              {story.recordingId === life.latestRecordingId && <span aria-hidden="true" className="size-1.5 self-center rounded-full bg-ink-3" />}
            </span>
            <span
              className="mt-1 block font-serif text-[1.1875rem] leading-snug decoration-rule-2 underline-offset-[0.2em] group-hover:underline"
              lang={story.language ?? undefined}
            >
              {story.title}
            </span>
            {link && (
              <span
                className={`animate-appear mt-1 block text-[0.875rem] transition-colors duration-500 ${link.lit ? "text-voice" : "text-ink-2"}`}
                lang={language ?? undefined}
              >
                {link.names.join(" · ")}
              </span>
            )}
            <span className="mt-2 block text-ink">
              <Bars story={story} width={w} height={12} progress={playingId === story.id ? progress : 0} heard={heard[story.id]} rest />
              <span className="mt-[3px] block">
                <Rhythm story={story} width={w} height={3} progress={playingId === story.id ? progress : 0} />
              </span>
            </span>
          </button>
        )}
      </li>
    );
  };

  return (
    <div ref={list}>
      <ol className="relative before:absolute before:top-3 before:bottom-3 before:left-[5px] before:w-px before:bg-axis">
        <li className="relative pb-2 pl-7">
          <span aria-hidden="true" className="absolute top-[0.45rem] left-[2px] size-[7px] rounded-full bg-axis" />
          <span className="t-small text-ink-2">
            {t.life.born} {life.birthYear ?? ""}
          </span>
        </li>
        {items.map((item, i) =>
          item.kind === "story" ? (
            row(item.story)
          ) : (
            <li key={`gap-${i}`} className="relative py-6 pl-7">
              <span
                aria-hidden="true"
                className="absolute top-0 bottom-0 left-[3px] w-[5px] bg-paper [background-image:linear-gradient(var(--line-strong)_1px,transparent_1px)] [background-size:5px_6px] bg-repeat-y"
              />
              <span className="t-small text-ink-3 italic">
                {item.from}–{item.to} · {t.life.gap(item.years)}
              </span>
            </li>
          ),
        )}
        <li className="relative pt-2 pl-7">
          <span aria-hidden="true" className="absolute top-[0.95rem] left-[2px] size-[7px] rounded-full bg-axis" />
          <span className="t-small text-ink-2">{t.life.now(end)}</span>
          {life.latestRecordingId && (
            <span className="t-small ml-3 inline-flex items-center gap-1.5 text-ink-2">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-ink-3" />
              {t.life.latest}
            </span>
          )}
        </li>
      </ol>

      {trailEntity && (
        <div className="mt-6 flex items-baseline justify-between gap-4 border-t border-rule pt-4">
          <p className="flex items-baseline gap-2">
            <span aria-hidden="true" className="size-2 translate-y-[-2px] rounded-full bg-voice" />
            <span className="font-serif text-[1.25rem]" lang={language ?? undefined}>
              {trailEntity.name}
            </span>
          </p>
          <button type="button" onClick={() => setTrail(null)} className="inline-flex min-h-11 items-center text-[0.9375rem] text-ink-2 hover:text-ink">
            {t.life.clearTrail}
          </button>
        </div>
      )}

      {undated.length > 0 && (
        <div className="mt-6 border-t border-rule pt-4">
          <p className="t-small text-ink-2">{t.life.unplaced}</p>
          <ol className="mt-1">{undated.map(row)}</ol>
        </div>
      )}
    </div>
  );
}
