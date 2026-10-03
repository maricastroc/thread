"use client";

import { useEffect, useRef, useState } from "react";
import { isSameTrack, useAudioState } from "@/components/audio/AudioProvider";
import type { Life, LifeEntity, LifeStory } from "@/lib/life";
import { FragmentOpen, Glyph, parseMentionState, trackOf, useMentionState, whenLabel } from "./shared";

const LANE = 30;
const TOP = 70;
const MAX_PEOPLE = 6;
const MAX_PLACES = 5;
const UNPLACED = 96;

export function ThreadsPrototype({ life }: { life: Life }) {
  const plot = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const [openId, setOpenId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [entity, setEntity] = useState<string | null>(null);

  useEffect(() => {
    const el = plot.current;
    if (!el) return;
    const observer = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const start = life.birthYear ?? Math.min(...life.stories.map((s) => s.from ?? life.now)) - 5;
  const end = life.now;
  const undated = life.stories.filter((s) => s.year === null);
  const span = width - (undated.length ? UNPLACED : 0);
  const x = (year: number) => ((year - start) / (end - start)) * span;
  const people = life.entities.filter((e) => e.kind === "person").slice(0, MAX_PEOPLE);
  const places = life.entities.filter((e) => e.kind === "place").slice(0, MAX_PLACES);
  const lanes: (LifeEntity | null)[] = [null, ...people, ...places];
  const laneY = (i: number) => TOP + i * LANE + (i > 0 ? 26 : 0) + (i > people.length ? 22 : 0);
  const height = laneY(lanes.length - 1) + 64;
  const storyById = new Map(life.stories.map((s) => [s.id, s]));

  const open = openId ? storyById.get(openId) ?? null : null;
  const { lit } = parseMentionState(useMentionState(open));
  const playingId = useAudioState((s) => (s.track?.storyId && s.playing ? s.track.storyId : null));
  const progress = useAudioState((s) => (open && isSameTrack(s.track, trackOf(open)) ? Math.round(((s.time - open.start) / Math.max(1, open.duration)) * 30) / 30 : 0));
  const focus = hoverId ? storyById.get(hoverId) ?? null : open;
  const focusEntities = focus ? new Set([...focus.people, ...focus.places].map((e) => e.id)) : null;
  const trail = entity ? new Set(life.entities.find((e) => e.id === entity)?.storyIds ?? []) : null;

  const storyX = (s: LifeStory, i: number) => (s.year !== null ? x(s.year + 0.5) : span + 24 + (i % 3) * 22);
  const unplacedIndex = new Map(undated.map((s, i) => [s.id, i]));
  const decades: number[] = [];
  for (let d = Math.ceil(start / 10) * 10; d <= end; d += 10) decades.push(d);

  const laneOf = (id: string) => lanes.findIndex((l) => l?.id === id);
  const touches = (s: LifeStory) => [0, ...[...s.people, ...s.places].map((e) => laneOf(e.id)).filter((i) => i > 0)].sort((a, b) => a - b);

  const covered = new Set<number>(life.stories.filter((s) => s.year !== null).map((s) => s.year!));

  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6">
      <header className="pt-6 pb-6 sm:pt-12">
        <h1 className="t-display">{life.narrator}</h1>
        <p className="t-meta mt-4 max-w-[46rem]">
          The people and places that run through {life.narrator}’s stories. Each vertical knot is a story; it ties together everyone and everywhere it mentions.
        </p>
      </header>

      <div className="overflow-x-auto pb-2 lg:overflow-visible">
        <div className="grid min-w-[56rem] grid-cols-[9.5rem_minmax(0,1fr)] gap-x-4">
          <div className="relative" style={{ height }}>
            {lanes.map((lane, i) => {
              const y = laneY(i);
              if (!lane) {
                return (
                  <p key="narrator" className="absolute right-0 font-serif text-[1.125rem] leading-none" style={{ top: y - 9 }}>
                    {life.narrator}
                  </p>
                );
              }
              const active = entity === lane.id;
              const litNow = lit.has(lane.id);
              return (
                <button
                  key={lane.id}
                  type="button"
                  onClick={() => setEntity(active ? null : lane.id)}
                  aria-pressed={active}
                  className={`absolute right-0 flex items-baseline gap-1.5 text-right transition-colors ${
                    active || litNow ? "text-ink" : entity ? "text-ink-3" : "text-ink-2 hover:text-ink"
                  }`}
                  style={{ top: y - 10 }}
                  lang={life.stories[0]?.language ?? undefined}
                >
                  {lane.relation && <span className="t-small text-ink-3">{lane.relation}</span>}
                  <span className={`max-w-[7.5rem] truncate font-serif text-[1rem] leading-tight ${active ? "underline decoration-ink underline-offset-4" : ""}`} title={lane.name}>
                    {lane.name}
                  </span>
                  {litNow && <span aria-hidden="true" className="ml-1 size-1.5 self-center rounded-full bg-voice" />}
                </button>
              );
            })}
            <p className="t-kicker absolute right-0" style={{ top: laneY(1) - 34 }}>
              People
            </p>
            {places.length > 0 && (
              <p className="t-kicker absolute right-0" style={{ top: laneY(people.length + 1) - 34 }}>
                Places
              </p>
            )}
          </div>

          <div ref={plot} className="relative" style={{ height }}>
            <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
              {decades.map((d) => (
                <g key={d}>
                  <line x1={x(d)} x2={x(d)} y1={TOP - 40} y2={height - 34} className="stroke-rule" strokeWidth={1} />
                </g>
              ))}
              <line x1={0} x2={span} y1={laneY(0)} y2={laneY(0)} className="stroke-ink" strokeOpacity={0.3} strokeDasharray="2 4" />
              {[...covered].map((y) => (
                <line key={y} x1={x(y)} x2={x(y + 1)} y1={laneY(0)} y2={laneY(0)} className="stroke-ink" strokeWidth={2.5} />
              ))}
              {lanes.map((lane, i) => {
                if (!lane) return null;
                const years = lane.storyIds
                  .map((id) => storyById.get(id))
                  .filter((s): s is LifeStory => !!s && s.year !== null)
                  .map((s) => s.year!);
                if (!years.length) return null;
                const a = Math.min(...years);
                const b = Math.max(...years);
                const active = entity === lane.id || lit.has(lane.id);
                const dim = (entity && entity !== lane.id) || (focusEntities && !focusEntities.has(lane.id));
                return (
                  <line
                    key={lane.id}
                    x1={x(a + 0.5)}
                    x2={x(b + 0.5) + 0.01}
                    y1={laneY(i)}
                    y2={laneY(i)}
                    className={active ? "stroke-voice" : "stroke-ink"}
                    strokeWidth={active ? 2 : 1.25}
                    strokeOpacity={dim ? 0.15 : active ? 1 : 0.45}
                    strokeLinecap="round"
                  />
                );
              })}
              {life.stories.map((s) => {
                const lanesHit = touches(s);
                const cx = storyX(s, unplacedIndex.get(s.id) ?? 0);
                const bottom = laneY(lanesHit[lanesHit.length - 1]);
                const dim = (trail && !trail.has(s.id)) || (focus && focus.id !== s.id && !hoverId && !!open);
                const certain = s.certainty === "exact" || s.certainty === "range";
                return (
                  <g key={s.id} opacity={dim ? 0.2 : 1} className="transition-opacity duration-300">
                    {s.year !== null && !certain && s.from !== null && s.to !== null && (
                      <rect x={x(s.from)} y={laneY(0) - 4} width={Math.max(3, x(s.to + 1) - x(s.from))} height={8} rx={4} className="fill-ink/[0.1]" />
                    )}
                    <line
                      x1={cx}
                      x2={cx}
                      y1={laneY(0)}
                      y2={bottom}
                      className={playingId === s.id || open?.id === s.id ? "stroke-voice" : "stroke-ink"}
                      strokeWidth={open?.id === s.id ? 2 : 1.25}
                      strokeDasharray={certain ? undefined : s.year === null ? "1 3" : "3 3"}
                    />
                    {lanesHit.map((li) => {
                      const lane = lanes[li];
                      const isLit = lane && lit.has(lane.id) && open?.id === s.id;
                      return (
                        <circle
                          key={li}
                          cx={cx}
                          cy={laneY(li)}
                          r={li === 0 ? 4 : 3.25}
                          className={isLit ? "fill-voice" : certain ? "fill-ink" : "fill-paper stroke-ink"}
                          strokeWidth={1.2}
                        />
                      );
                    })}
                  </g>
                );
              })}
            </svg>

            {life.stories.map((s) => {
              const cx = storyX(s, unplacedIndex.get(s.id) ?? 0);
              const w = Math.min(44, Math.max(16, s.duration * 0.6));
              const isOpen = open?.id === s.id;
              const dim = trail && !trail.has(s.id);
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
                  aria-label={`${s.title}, ${whenLabel(s)}`}
                  className={`absolute -translate-x-1/2 rounded-[3px] transition-[opacity,color] duration-300 ${isOpen ? "text-ink" : "text-ink-2 hover:text-ink"}`}
                  style={{ left: cx, top: laneY(0) - 34, opacity: dim ? 0.25 : 1 }}
                >
                  <Glyph story={s} width={w} height={26} progress={isOpen ? progress : 0} />
                  {s.recordingId === life.latestRecordingId && (
                    <span aria-hidden="true" className="absolute -top-2 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-voice" />
                  )}
                </button>
              );
            })}

            {hoverId &&
              (() => {
                const s = storyById.get(hoverId);
                if (!s) return null;
                const cx = storyX(s, unplacedIndex.get(s.id) ?? 0);
                return (
                  <div className="pointer-events-none absolute z-10 w-max max-w-[15rem] -translate-x-1/2 pb-1" style={{ left: Math.min(span - 100, Math.max(100, cx)), top: 0 }}>
                    <p className="font-serif text-[0.9375rem] leading-snug" lang={s.language ?? undefined}>
                      {s.title}
                    </p>
                    <p className="t-small text-ink-2">{whenLabel(s)}</p>
                  </div>
                );
              })()}

            {open &&
              (() => {
                const cx = storyX(open, unplacedIndex.get(open.id) ?? 0);
                const right = cx > span * 0.55;
                return (
                  <div
                    className="absolute z-20 w-[27rem] max-w-[calc(100%-2rem)] rounded-md border border-rule-2 bg-paper p-5 shadow-[0_18px_40px_-28px_rgb(0_0_0/0.45)]"
                    style={right ? { right: Math.max(8, width - cx + 18), top: laneY(1) - 8 } : { left: Math.min(width - 440, cx + 18), top: laneY(1) - 8 }}
                  >
                    <FragmentOpen story={open} activeEntity={entity} onEntity={setEntity} onClose={() => setOpenId(null)} compact />
                  </div>
                );
              })()}

            {decades.map((d) => (
              <span key={d} className="t-time absolute text-ink-2" style={{ left: x(d), top: height - 28, transform: "translateX(-50%)" }}>
                {d}
              </span>
            ))}
            {undated.length > 0 && (
              <span className="t-small absolute text-ink-2" style={{ left: span + 12, top: height - 28 }}>
                no date
              </span>
            )}
          </div>
        </div>
      </div>

      {!open && (
        <p className="mt-4 max-w-[36rem] border-t border-rule pt-6 font-serif text-[1.25rem] leading-snug text-ink-2">
          Choose a person or a place to follow it through the years, or a story to hear it.
        </p>
      )}
    </section>
  );
}
