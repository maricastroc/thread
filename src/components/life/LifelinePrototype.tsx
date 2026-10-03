"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { isSameTrack, useAudioState } from "@/components/audio/AudioProvider";
import { formatClock } from "@/lib/format";
import type { Life, LifeStory } from "@/lib/life";
import { STAGE_SPANS } from "@/lib/life";
import { t } from "@/lib/i18n";
import { FragmentOpen, Glyph, TrailBar, parseMentionState, trackOf, useMentionState, whenLabel } from "./shared";

const AXIS_Y = 210;
const ROW_H = 34;

type Placed = { story: LifeStory; x: number; w: number; row: number };

function glyphWidth(duration: number) {
  return Math.round(Math.min(96, Math.max(18, duration * 1.15)));
}

export function LifelinePrototype({ life }: { life: Life }) {
  const frame = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1100);
  const [openId, setOpenId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [entity, setEntity] = useState<string | null>(null);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const start = life.birthYear ?? Math.min(...life.stories.map((s) => s.from ?? life.now)) - 5;
  const end = life.now;
  const x = (year: number) => ((year - start) / (end - start)) * width;
  const dated = life.stories.filter((s) => s.year !== null);
  const undated = life.stories.filter((s) => s.year === null);
  const open = life.stories.find((s) => s.id === openId) ?? null;
  const playingId = useAudioState((s) => (s.track?.storyId && s.playing ? s.track.storyId : null));
  const progress = useAudioState((s) => {
    if (!open || !isSameTrack(s.track, trackOf(open))) return 0;
    return Math.round(((s.time - open.start) / Math.max(1, open.duration)) * 40) / 40;
  });
  const { lit } = parseMentionState(useMentionState(open));
  const highlight = entity ?? (lit.size ? [...lit][lit.size - 1] : null);
  const related = highlight ? new Set(life.entities.find((e) => e.id === highlight)?.storyIds ?? []) : null;

  const placed = useMemo(() => {
    const rows: { right: number }[][] = [];
    const result: Placed[] = [];
    for (const story of [...dated].sort((a, b) => a.year! - b.year!)) {
      const w = glyphWidth(story.duration);
      const left = Math.min(width - w, Math.max(0, x(story.year!) - w / 2));
      let row = 0;
      while (rows[row]?.some((r) => left < r.right + 6)) row++;
      rows[row] = [...(rows[row] ?? []), { right: left + w }];
      result.push({ story, x: left, w, row });
    }
    return result;
  }, [dated, width]);

  const stages = life.birthYear
    ? (Object.entries(STAGE_SPANS) as [keyof typeof STAGE_SPANS, [number, number]][])
        .map(([stage, [a, b]]) => ({ stage, from: life.birthYear! + a, to: Math.min(end, life.birthYear! + b + 1) }))
        .filter((s) => s.from < end)
    : [];

  const covered = new Set<number>(dated.map((s) => s.year!));
  const reach = new Set<number>();
  for (const s of dated) for (let y = Math.round(s.from ?? s.year!); y <= Math.round(s.to ?? s.year!); y++) reach.add(y);
  const gaps: { from: number; to: number }[] = [];
  let gapStart: number | null = null;
  for (let y = start; y <= end; y++) {
    if (!reach.has(y)) gapStart ??= y;
    else if (gapStart !== null) {
      if (y - gapStart >= 8) gaps.push({ from: gapStart, to: y - 1 });
      gapStart = null;
    }
  }
  if (gapStart !== null && end - gapStart >= 8) gaps.push({ from: gapStart, to: end });

  const decades: number[] = [];
  for (let d = Math.ceil(start / 10) * 10; d <= end; d += 10) decades.push(d);
  const minutes = Math.round(life.stories.reduce((a, s) => a + s.duration, 0) / 60);
  const yearsWithVoice = covered.size;

  const anchor = open ? placed.find((p) => p.story.id === open.id) : null;
  const chain = related ? placed.filter((p) => related.has(p.story.id)).sort((a, b) => a.x - b.x) : [];

  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6">
      <header className="pt-6 pb-4 sm:pt-12">
        <h1 className="t-display">{life.narrator}</h1>
        <p className="t-meta mt-4 max-w-[46rem]">
          {life.birthYear ? `Born ${life.birthYear}. ` : ""}
          {life.stories.length} stories, {minutes} minutes of voice. A voice has been kept for {yearsWithVoice} of {end - start} years.
        </p>
      </header>

      <div className="overflow-x-auto pb-2 lg:overflow-visible">
        <div ref={frame} className="relative min-w-[56rem]" style={{ height: AXIS_Y + 92 }}>
          <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
            {stages.map((s) => (
              <g key={s.stage}>
                <line x1={x(s.from) + 1} x2={x(s.to) - 1} y1={AXIS_Y + 44} y2={AXIS_Y + 44} className="stroke-rule-2" strokeWidth={1} />
                <line x1={x(s.from) + 1} x2={x(s.from) + 1} y1={AXIS_Y + 40} y2={AXIS_Y + 48} className="stroke-rule-2" strokeWidth={1} />
              </g>
            ))}
            {gaps.map((g) => (
              <line key={g.from} x1={x(g.from)} x2={x(g.to)} y1={AXIS_Y} y2={AXIS_Y} className="stroke-rule-2" strokeWidth={1} strokeDasharray="2 4" />
            ))}
            <line x1={0} x2={width} y1={AXIS_Y} y2={AXIS_Y} className="stroke-ink" strokeWidth={1} strokeOpacity={0.35} />
            {[...covered].map((y) => (
              <line key={y} x1={x(y)} x2={x(y + 1)} y1={AXIS_Y} y2={AXIS_Y} className="stroke-ink" strokeWidth={2.5} />
            ))}
            {decades.map((d) => (
              <line key={d} x1={x(d)} x2={x(d)} y1={AXIS_Y - 5} y2={AXIS_Y + 5} className="stroke-ink" strokeOpacity={0.5} />
            ))}
            {placed.map((p) => {
              const s = p.story;
              const top = AXIS_Y - 14 - p.row * ROW_H;
              const cx = p.x + p.w / 2;
              const dim = related ? !related.has(s.id) : open ? open.id !== s.id : false;
              const opacity = dim ? 0.25 : 1;
              const stem = s.certainty === "exact" || s.certainty === "range" ? undefined : s.certainty === "approximate" ? "3 3" : "1 3";
              return (
                <g key={s.id} opacity={opacity} className="transition-opacity duration-300">
                  {s.certainty !== "exact" && s.from !== null && s.to !== null && (
                    <rect
                      x={x(s.from)}
                      y={AXIS_Y - 3}
                      width={Math.max(2, x(s.to + 1) - x(s.from))}
                      height={6}
                      rx={3}
                      className={s.certainty === "stage" ? "fill-ink/[0.05]" : "fill-ink/[0.12]"}
                    />
                  )}
                  <line x1={cx} x2={x(s.year!) + (x(s.year! + 1) - x(s.year!)) / 2} y1={top} y2={AXIS_Y} className={playingId === s.id ? "stroke-voice" : "stroke-ink"} strokeOpacity={playingId === s.id ? 1 : 0.28} strokeDasharray={stem} />
                  <circle
                    cx={x(s.year!) + (x(s.year! + 1) - x(s.year!)) / 2}
                    cy={AXIS_Y}
                    r={3.5}
                    className={s.certainty === "exact" || s.certainty === "range" ? "fill-ink" : "fill-paper stroke-ink"}
                    strokeWidth={1.2}
                  />
                </g>
              );
            })}
            {chain.length > 1 &&
              chain.slice(1).map((p, i) => {
                const a = chain[i];
                const ax = a.x + a.w / 2;
                const bx = p.x + p.w / 2;
                const ay = AXIS_Y - 14 - a.row * ROW_H - 30;
                const by = AXIS_Y - 14 - p.row * ROW_H - 30;
                const lift = Math.min(70, Math.abs(bx - ax) * 0.25 + 18);
                return (
                  <path
                    key={p.story.id}
                    d={`M ${ax} ${ay} C ${ax} ${ay - lift}, ${bx} ${by - lift}, ${bx} ${by}`}
                    className="animate-rise fill-none stroke-voice"
                    strokeWidth={1.25}
                  />
                );
              })}
            {anchor && (
              <line
                x1={anchor.x + anchor.w / 2}
                x2={anchor.x + anchor.w / 2}
                y1={AXIS_Y + 4}
                y2={AXIS_Y + 92}
                className="stroke-ink"
                strokeWidth={1}
              />
            )}
          </svg>

          {placed.map((p) => {
            const s = p.story;
            const top = AXIS_Y - 14 - p.row * ROW_H - 30;
            const dim = related ? !related.has(s.id) : open ? open.id !== s.id : false;
            const isOpen = open?.id === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setOpenId(isOpen ? null : s.id)}
                onMouseEnter={() => setHoverId(s.id)}
                onMouseLeave={() => setHoverId(null)}
                onFocus={() => setHoverId(s.id)}
                onBlur={() => setHoverId(null)}
                aria-pressed={isOpen}
                aria-label={`${s.title}, ${whenLabel(s)}, ${formatClock(s.duration)}`}
                className={`absolute rounded-[3px] transition-[opacity,color] duration-300 ${isOpen ? "text-ink" : "text-ink-2 hover:text-ink"}`}
                style={{ left: p.x, top, width: p.w, height: 30, opacity: dim ? 0.3 : 1 }}
              >
                <Glyph story={s} width={p.w} height={30} progress={isOpen ? progress : 0} />
                {s.recordingId === life.latestRecordingId && (
                  <span aria-hidden="true" className="absolute -top-2 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-voice" />
                )}
              </button>
            );
          })}

          {hoverId &&
            (() => {
              const p = placed.find((q) => q.story.id === hoverId);
              if (!p || p.story.id === openId) return null;
              const top = AXIS_Y - 14 - p.row * ROW_H - 30;
              return (
                <div
                  className="pointer-events-none absolute z-10 w-max max-w-[16rem] -translate-x-1/2 -translate-y-full pb-2"
                  style={{ left: Math.min(width - 120, Math.max(120, p.x + p.w / 2)), top }}
                >
                  <p className="font-serif text-[1rem] leading-snug" lang={p.story.language ?? undefined}>
                    {p.story.title}
                  </p>
                  <p className="t-small text-ink-2">{whenLabel(p.story)}</p>
                </div>
              );
            })()}

          {chain.length > 0 &&
            highlight &&
            (() => {
              const entityInfo = life.entities.find((e) => e.id === highlight);
              const first = chain[0];
              const years = chain.map((p) => p.story.year!).filter(Boolean);
              const topRow = Math.max(...chain.map((p) => p.row));
              return entityInfo ? (
                <div
                  className="animate-rise pointer-events-none absolute flex items-baseline gap-2"
                  style={{ left: Math.max(0, first.x), top: Math.max(0, AXIS_Y - 14 - topRow * ROW_H - 30 - 92) }}
                >
                  <span aria-hidden="true" className="size-1.5 translate-y-[-2px] rounded-full bg-voice" />
                  <span className="font-serif text-[1.125rem] leading-none" lang={life.stories[0]?.language ?? undefined}>
                    {entityInfo.name}
                  </span>
                  <span className="t-small text-ink-2">
                    {Math.min(...years)}–{Math.max(...years)} · {chain.length} {chain.length === 1 ? "story" : "stories"}
                  </span>
                </div>
              ) : null;
            })()}

          {decades.map((d) => (
            <span key={d} className="t-time absolute text-ink-2" style={{ left: x(d), top: AXIS_Y + 12, transform: "translateX(-50%)" }}>
              {d}
            </span>
          ))}
          {stages.map((s) => (
            <span key={s.stage} className="t-small absolute pl-1.5 text-ink-2" style={{ left: x(s.from), top: AXIS_Y + 50 }}>
              {t.lifeStage[s.stage]}
            </span>
          ))}
          {gaps.map((g) => (
            <span
              key={g.from}
              className="t-small absolute text-center text-ink-3 italic"
              style={{ left: x(g.from), width: x(g.to) - x(g.from), top: AXIS_Y - 26 }}
            >
              {g.to - g.from + 1} years, no voice yet
            </span>
          ))}
          <span className="t-small absolute text-ink-2" style={{ left: 0, top: AXIS_Y + 72 }}>
            born
          </span>
          <span className="t-small absolute flex items-center gap-1.5 text-right text-ink-2" style={{ right: 0, top: AXIS_Y + 72 }}>
            <span aria-hidden="true" className="size-1.5 rounded-full bg-voice" /> latest recording · now, {end}
          </span>
        </div>
      </div>

      <div className="relative min-h-[14rem] border-t border-ink/60 pt-6" style={{ marginLeft: 0 }}>
        {open ? (
          <FragmentOpen story={open} activeEntity={entity} onEntity={setEntity} onClose={() => setOpenId(null)} />
        ) : (
          <p className="max-w-[36rem] font-serif text-[1.25rem] leading-snug text-ink-2">
            Each mark is a moment where {life.narrator}’s voice was kept. Its width is how long the story lasts. Choose one to open it.
          </p>
        )}
      </div>
      {undated.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-rule pt-4">
          <span className="t-small text-ink-2">Not yet placed in time</span>
          {undated.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setOpenId(openId === s.id ? null : s.id)}
              aria-pressed={openId === s.id}
              className={`flex items-center gap-2 rounded-sm text-ink-2 hover:text-ink ${openId === s.id ? "text-ink" : ""}`}
            >
              <Glyph story={s} width={glyphWidth(s.duration)} height={20} progress={0} />
              <span className="font-serif text-[0.9375rem]" lang={s.language ?? undefined}>
                {s.title}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 border-t border-rule pt-5">
        <TrailBar entities={life.entities} activeEntity={entity} onEntity={setEntity} language={life.stories[0]?.language ?? null} limit={8} />
      </div>

    </section>
  );
}
