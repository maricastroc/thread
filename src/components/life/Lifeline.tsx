"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowIcon } from "@/components/icons";
import { formatClock } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { Life, LifeEntity, LifeStory } from "@/lib/life";
import { STAGE_SPANS } from "@/lib/life";
import { Bars, Rhythm } from "./glyphs";
import {
  FragmentOpen,
  TrailBar,
  ageLabel,
  entityHref,
  gapsOf,
  glyphWidth,
  isCertain,
  lifeSpan,
  parseMentionState,
  useMentionState,
  usePlayingStory,
  useProgress,
  whenLabel,
} from "./shared";

const ROW_H = 24;
const NEAR_H = 22;
const TOP_SPACE = 52;

type Placed = { story: LifeStory; x: number; w: number; row: number };

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

function Fragment({
  story,
  width,
  near,
  progress,
  latest,
}: {
  story: LifeStory;
  width: number;
  near: boolean;
  progress: number;
  latest: boolean;
}) {
  return (
    <span className="relative block" style={{ width, height: ROW_H - 4 }}>
      <span
        className="absolute inset-x-0 bottom-[6px] block origin-bottom transition-[transform,opacity] duration-300 ease-[var(--ease-calm)]"
        style={{ transform: `scaleY(${near ? 1 : 0.2})`, opacity: near ? 1 : 0 }}
      >
        <Bars story={story} width={width} height={NEAR_H - 4} progress={progress} />
      </span>
      <span className="absolute inset-x-0 bottom-0 block">
        <Rhythm story={story} width={width} height={4} progress={progress} />
      </span>
      {latest && !near && <span aria-hidden="true" className="absolute bottom-[9px] left-0 size-1.5 rounded-full bg-voice" />}
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
  const playingId = usePlayingStory();
  const progress = useProgress(open);
  const { lit } = parseMentionState(useMentionState(open));
  const highlight = trail ?? (lit.size ? [...lit][lit.size - 1] : null);
  const highlightEntity = highlight ? life.entities.find((e) => e.id === highlight) ?? null : null;
  const related = highlightEntity ? new Set(highlightEntity.storyIds) : null;
  const language = life.stories[0]?.language ?? null;

  const shared = {
    life,
    open,
    openId,
    setOpenId,
    hoverId,
    setHoverId,
    related,
    highlightEntity,
    trail,
    setTrail,
    playingId,
    progress,
    language,
  };

  const bar = showTrailBar && life.entities.some((e) => trailKinds.includes(e.kind)) && (
    <div className={trailBarFirst ? "mb-8 border-b border-rule pb-5" : "mt-8 border-t border-rule pt-5"}>
      {!trailBarFirst && <p className="t-small mb-1 text-ink-2">{t.life.through}</p>}
      <TrailBar entities={life.entities} activeEntity={trail} onEntity={setTrail} language={language} kinds={trailKinds} limit={trailBarFirst ? 40 : 8} />
    </div>
  );

  return (
    <section aria-label={t.life.label(life.narrator)}>
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
  related: Set<string> | null;
  highlightEntity: LifeEntity | null;
  trail: string | null;
  setTrail: (id: string | null) => void;
  playingId: string | null;
  progress: number;
  language: string | null;
};

function TrailSummary({ entity, stories, onOpen, onClear, language }: { entity: LifeEntity; stories: LifeStory[]; onOpen: (id: string) => void; onClear: () => void; language: string | null }) {
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
        <button type="button" onClick={onClear} className="inline-flex min-h-11 items-center rounded-full px-3 text-[0.9375rem] text-ink-2 hover:bg-ink/[0.05] hover:text-ink">
          {t.life.clearTrail}
        </button>
      </div>
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
      <Link href={entityHref(entity)} className="mt-3 inline-flex min-h-11 items-center gap-2 text-[0.9375rem] text-ink-2 hover:text-ink" lang={language ?? undefined}>
        {t.life.everyMoment(entity.name)} <ArrowIcon size={14} />
      </Link>
    </div>
  );
}

function Invitations({ life, start, end }: { life: Life; start: number; end: number }) {
  const gaps = gapsOf(life, start, end)
    .sort((a, b) => b.to - b.from - (a.to - a.from))
    .slice(0, 2)
    .sort((a, b) => a.from - b.from);
  return (
    <div className="grid gap-8 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <p className="max-w-[34rem] font-serif text-[1.25rem] leading-snug text-ink-2">{t.life.hint(life.narrator)}</p>
      {gaps.length > 0 && (
        <ul className="space-y-1">
          {gaps.map((g) => (
            <li key={g.from} className="text-[0.9375rem]">
              <span className="text-ink-2">{t.life.gapAsk(g.from, g.to)} </span>
              <Link href={{ pathname: "/record", query: { q: t.life.gapQuestion(g.from, g.to) } }} className="link inline-flex min-h-11 items-center">
                {t.life.askAbout}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Horizontal(props: Shared) {
  const { life, open, openId, setOpenId, hoverId, setHoverId, related, highlightEntity, trail, setTrail, playingId, progress, language } = props;
  const frame = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1100);
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { start, end } = lifeSpan(life);
  const x = (year: number) => ((year - start) / (end - start)) * width;
  const center = (year: number) => x(year + 0.5);
  const dated = life.stories.filter((s) => s.year !== null);
  const undated = life.stories.filter((s) => s.year === null);

  const placed = (() => {
    const rows: { right: number }[][] = [];
    const result: Placed[] = [];
    for (const story of [...dated].sort((a, b) => a.year! - b.year! || a.recordedAt.localeCompare(b.recordedAt))) {
      const w = glyphWidth(story.duration);
      const left = Math.min(width - w, Math.max(0, center(story.year!) - w / 2));
      let row = 0;
      while (rows[row]?.some((r) => left < r.right + 8)) row++;
      rows[row] = [...(rows[row] ?? []), { right: left + w }];
      result.push({ story, x: left, w, row });
    }
    return result;
  })();

  const maxRow = Math.max(0, ...placed.map((p) => p.row));
  const axisY = TOP_SPACE + (maxRow + 1) * ROW_H + 8;
  const height = axisY + 92;
  const topOf = (row: number) => axisY - 8 - (row + 1) * ROW_H + 4;

  const stages = life.birthYear
    ? (Object.entries(STAGE_SPANS) as [keyof typeof STAGE_SPANS, [number, number]][])
        .map(([stage, [a, b]]) => ({ stage, from: life.birthYear! + a, to: Math.min(end + 1, life.birthYear! + b + 1) }))
        .filter((s) => s.from < end)
    : [];
  const covered = new Set(dated.map((s) => s.year!));
  const gaps = gapsOf(life, start, end);
  const decades: number[] = [];
  for (let d = Math.ceil(start / 10) * 10; d <= end; d += 10) decades.push(d);

  const anchor = open ? placed.find((p) => p.story.id === open.id) : null;
  const chain = related ? placed.filter((p) => related.has(p.story.id)).sort((a, b) => a.x - b.x) : [];
  const trailStories = highlightEntity ? life.stories.filter((s) => highlightEntity.storyIds.includes(s.id)) : [];

  return (
    <div>
      <div ref={frame} className="relative" style={{ height }}>
        <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
          {stages.map((s) => (
            <g key={s.stage}>
              <line x1={x(s.from) + 1} x2={x(s.to) - 1} y1={axisY + 46} y2={axisY + 46} className="stroke-rule-2" />
              <line x1={x(s.from) + 1} x2={x(s.from) + 1} y1={axisY + 42} y2={axisY + 50} className="stroke-rule-2" />
            </g>
          ))}
          <line x1={0} x2={width} y1={axisY} y2={axisY} className="stroke-ink" strokeOpacity={0.3} />
          {gaps.map((g) => (
            <line key={g.from} x1={x(g.from)} x2={x(g.to + 1)} y1={axisY} y2={axisY} className="stroke-paper" strokeWidth={2} strokeDasharray="1 5" />
          ))}
          {[...covered].map((y) => (
            <line key={y} x1={x(y) + 0.5} x2={x(y + 1) - 0.5} y1={axisY} y2={axisY} className="stroke-ink" strokeWidth={2.5} strokeLinecap="round" />
          ))}
          {decades.map((d) => (
            <line key={d} x1={x(d)} x2={x(d)} y1={axisY - 4} y2={axisY + 4} className="stroke-ink" strokeOpacity={0.45} />
          ))}
          {placed.map((p) => {
            const s = p.story;
            const dim = related ? !related.has(s.id) : open ? open.id !== s.id : false;
            const certain = isCertain(s);
            const cx = p.x + p.w / 2;
            const ax = center(s.year!);
            return (
              <g key={s.id} opacity={dim ? 0.18 : 1} className="transition-opacity duration-500">
                {!certain && s.from !== null && s.to !== null && (
                  <rect x={x(s.from)} y={axisY - 3} width={Math.max(3, x(s.to + 1) - x(s.from))} height={6} rx={3} className={s.certainty === "stage" ? "fill-ink/[0.05]" : "fill-ink/[0.12]"} />
                )}
                <line
                  x1={cx}
                  x2={ax}
                  y1={topOf(p.row) + ROW_H - 4}
                  y2={axisY}
                  className={playingId === s.id ? "stroke-voice" : "stroke-ink"}
                  strokeOpacity={playingId === s.id || open?.id === s.id ? 0.9 : 0.2}
                  strokeDasharray={certain ? undefined : s.certainty === "approximate" ? "2 3" : "1 3"}
                />
                <circle cx={ax} cy={axisY} r={3.5} className={certain ? "fill-ink" : "fill-paper stroke-ink"} strokeWidth={1.2} />
              </g>
            );
          })}
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
          {anchor && (
            <line x1={anchor.x + anchor.w / 2} x2={anchor.x + anchor.w / 2} y1={axisY + 4} y2={height} className="stroke-ink" strokeOpacity={0.6} />
          )}
        </svg>

        {placed.map((p) => {
          const s = p.story;
          const dim = related ? !related.has(s.id) : open ? open.id !== s.id : false;
          const isOpen = open?.id === s.id;
          const near = isOpen || hoverId === s.id || playingId === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setHoverId(null);
                setOpenId(isOpen ? null : s.id);
              }}
              onMouseEnter={() => setHoverId(s.id)}
              onMouseLeave={() => setHoverId(null)}
              onFocus={() => setHoverId(s.id)}
              onBlur={() => setHoverId(null)}
              aria-pressed={isOpen}
              aria-label={`${s.title}. ${whenLabel(s)}${ageLabel(s) ? `, ${ageLabel(s)}` : ""}. ${formatClock(s.duration)}`}
              className={`absolute rounded-[2px] text-ink transition-opacity duration-500 ${near ? "z-10" : ""}`}
              style={{ left: p.x, top: topOf(p.row), width: p.w, height: ROW_H - 4, opacity: dim ? 0.22 : 1 }}
            >
              <Fragment story={s} width={p.w} near={near} progress={isOpen || playingId === s.id ? progress : 0} latest={s.recordingId === life.latestRecordingId} />
            </button>
          );
        })}

        {hoverId &&
          hoverId !== openId &&
          (() => {
            const p = placed.find((q) => q.story.id === hoverId);
            if (!p) return null;
            const age = ageLabel(p.story);
            return (
              <div
                role="presentation"
                className="pointer-events-none absolute z-20 w-max max-w-[17rem] -translate-x-1/2 -translate-y-full rounded-[3px] bg-paper/95 px-2 py-1.5 shadow-[0_0_0_1px_var(--rule)]"
                style={{ left: Math.min(width - 130, Math.max(130, p.x + p.w / 2)), top: topOf(p.row) - 6 }}
              >
                <p className="font-serif text-[1rem] leading-snug" lang={p.story.language ?? undefined}>
                  {p.story.title}
                </p>
                <p className="t-small text-ink-2">
                  {whenLabel(p.story)}
                  {age ? ` · ${age}` : ""} · {formatClock(p.story.duration)}
                </p>
              </div>
            );
          })()}

        {highlightEntity && chain.length > 0 && !hoverId && (
          <div className="animate-rise pointer-events-none absolute flex items-baseline gap-2" style={{ left: Math.min(width - 260, chain[0].x), top: 4 }}>
            <span aria-hidden="true" className="size-1.5 translate-y-[-2px] rounded-full bg-voice" />
            <span className="font-serif text-[1.0625rem] leading-none" lang={language ?? undefined}>
              {highlightEntity.name}
            </span>
          </div>
        )}

        {gaps
          .filter((g) => x(g.to + 1) - x(g.from) >= 120)
          .map((g) => (
            <span key={g.from} className="t-small absolute text-center text-ink-3 italic" style={{ left: x(g.from), width: x(g.to + 1) - x(g.from), top: axisY - 24 }}>
              {t.life.gap(g.to - g.from + 1)}
            </span>
          ))}
        {decades.map((d) => (
          <span key={d} className="t-time absolute text-ink-2" style={{ left: x(d), top: axisY + 12, transform: "translateX(-50%)" }}>
            {d}
          </span>
        ))}
        {stages.map((s) => (
          <span key={s.stage} className="t-small absolute pl-1.5 text-ink-2" style={{ left: x(s.from), top: axisY + 52 }}>
            {t.lifeStage[s.stage]}
          </span>
        ))}
        <span className="t-small absolute text-ink-2" style={{ left: 0, top: axisY + 72 }}>
          {t.life.born} {life.birthYear ?? ""}
        </span>
        <span className="t-small absolute flex items-center gap-1.5 text-ink-2" style={{ right: 0, top: axisY + 72 }}>
          {life.latestRecordingId && (
            <>
              <span aria-hidden="true" className="size-1.5 rounded-full bg-voice" /> {t.life.latest} ·
            </>
          )}{" "}
          {t.life.now(end)}
        </span>
      </div>

      <div className="min-h-[13rem] border-t border-ink/50 pt-6">
        {open ? (
          <FragmentOpen story={open} activeEntity={trail} onEntity={setTrail} onClose={() => setOpenId(null)} />
        ) : highlightEntity ? (
          <TrailSummary entity={highlightEntity} stories={trailStories} onOpen={setOpenId} onClear={() => setTrail(null)} language={language} />
        ) : (
          <Invitations life={life} start={start} end={end} />
        )}
      </div>

      {undated.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-rule pt-4">
          <span className="t-small text-ink-2">{t.life.unplaced}</span>
          {undated.map((s) => {
            const dim = related ? !related.has(s.id) : false;
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
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Vertical(props: Shared) {
  const { life, open, setOpenId, related, highlightEntity, trail, setTrail, playingId, progress, language } = props;
  const { start, end } = lifeSpan(life);
  const dated = [...life.stories.filter((s) => s.year !== null)].sort((a, b) => a.year! - b.year! || a.recordedAt.localeCompare(b.recordedAt));
  const undated = life.stories.filter((s) => s.year === null);
  const relatedDated = related ? dated.filter((s) => related.has(s.id)) : [];

  const items: ({ kind: "story"; story: LifeStory } | { kind: "gap"; from: number; to: number; years: number })[] = [];
  let previous = start;
  for (const story of dated) {
    const years = story.year! - previous;
    if (years >= 8) items.push({ kind: "gap", from: previous + 1, to: story.year! - 1, years: years - 1 });
    items.push({ kind: "story", story });
    previous = story.year!;
  }
  if (end - previous >= 8) items.push({ kind: "gap", from: previous + 1, to: end, years: end - previous });

  const row = (story: LifeStory) => {
    const isOpen = open?.id === story.id;
    const dim = related ? !related.has(story.id) : false;
    const age = ageLabel(story);
    const inTrail = related?.has(story.id);
    const w = Math.min(150, glyphWidth(story.duration) * 1.4);
    return (
      <li key={story.id} className="relative pl-7" style={{ opacity: dim ? 0.3 : 1 }}>
        <span
          aria-hidden="true"
          className={`absolute top-[0.85rem] left-[1px] size-[9px] rounded-full border-[1.5px] ${
            inTrail ? "border-voice bg-voice" : isCertain(story) ? "border-ink bg-ink" : "border-ink bg-paper"
          }`}
        />
        {isOpen ? (
          <div className="py-3">
            <FragmentOpen story={story} activeEntity={trail} onEntity={setTrail} onClose={() => setOpenId(null)} compact headingLevel="h3" />
          </div>
        ) : (
          <button type="button" onClick={() => setOpenId(story.id)} className="group block w-full py-2.5 text-left">
            <span className="flex items-baseline gap-2 text-[0.875rem]">
              <span className={isCertain(story) ? "text-ink" : "text-ink-2 italic"}>{whenLabel(story)}</span>
              {age && <span className="text-ink-2">· {age}</span>}
              {story.recordingId === life.latestRecordingId && <span aria-hidden="true" className="size-1.5 self-center rounded-full bg-voice" />}
            </span>
            <span className="mt-1 block font-serif text-[1.1875rem] leading-snug decoration-rule-2 underline-offset-[0.2em] group-hover:underline" lang={story.language ?? undefined}>
              {story.title}
            </span>
            <span className="mt-2 block text-ink-2">
              <Rhythm story={story} width={w} height={3} progress={playingId === story.id ? progress : 0} />
            </span>
          </button>
        )}
      </li>
    );
  };

  return (
    <div>
      <ol className="relative before:absolute before:top-3 before:bottom-3 before:left-[5px] before:w-px before:bg-ink/30">
        <li className="relative pl-7 pb-2">
          <span aria-hidden="true" className="absolute top-[0.45rem] left-[2px] size-[7px] rounded-full bg-ink/40" />
          <span className="t-small text-ink-2">
            {t.life.born} {life.birthYear ?? ""}
          </span>
        </li>
        {items.map((item, i) =>
          item.kind === "story" ? (
            row(item.story)
          ) : (
            <li key={`gap-${i}`} className="relative py-6 pl-7">
              <span aria-hidden="true" className="absolute top-0 bottom-0 left-[3px] w-[5px] bg-paper [background-image:linear-gradient(var(--ink)_1px,transparent_1px)] [background-size:5px_6px] bg-repeat-y opacity-25" />
              <span className="t-small text-ink-3 italic">
                {item.from}–{item.to} · {t.life.gap(item.years)}
              </span>
            </li>
          ),
        )}
        <li className="relative pt-2 pl-7">
          <span aria-hidden="true" className="absolute top-[0.95rem] left-[2px] size-[7px] rounded-full bg-ink/40" />
          <span className="t-small text-ink-2">{t.life.now(end)}</span>
        </li>
      </ol>

      {highlightEntity && relatedDated.length + undated.filter((s) => related?.has(s.id)).length > 0 && (
        <div className="mt-6 flex items-baseline justify-between gap-4 border-t border-rule pt-4">
          <p className="flex items-baseline gap-2">
            <span aria-hidden="true" className="size-2 translate-y-[-2px] rounded-full bg-voice" />
            <span className="font-serif text-[1.25rem]" lang={language ?? undefined}>
              {highlightEntity.name}
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
