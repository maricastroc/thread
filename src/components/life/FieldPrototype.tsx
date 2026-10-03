"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { isSameTrack, useAudioState } from "@/components/audio/AudioProvider";
import type { Life, LifeStory } from "@/lib/life";
import { FragmentOpen, Glyph, TrailBar, parseMentionState, trackOf, useMentionState, whenLabel } from "./shared";

type Cell = { year: number; age: number | null; exact: LifeStory[]; approximate: LifeStory[] };

export function FieldPrototype({ life }: { life: Life }) {
  const start = life.birthYear ?? Math.floor(Math.min(...life.stories.map((s) => s.from ?? life.now)) / 10) * 10;
  const end = life.now;
  const [openId, setOpenId] = useState<string | null>(null);
  const [entity, setEntity] = useState<string | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const cellRefs = useRef(new Map<number, HTMLElement>());
  const [centers, setCenters] = useState<Map<number, { x: number; y: number }>>(new Map());

  const cells: Cell[] = [];
  for (let year = start; year <= end; year++) {
    cells.push({
      year,
      age: life.birthYear ? year - life.birthYear : null,
      exact: life.stories.filter((s) => (s.certainty === "exact" || s.certainty === "range") && s.year === year),
      approximate: life.stories.filter((s) => (s.certainty === "approximate" || s.certainty === "stage") && s.from !== null && s.to !== null && year >= s.from && year <= s.to),
    });
  }
  const rows: Cell[][] = [];
  for (let i = 0; i < cells.length; i += 10) rows.push(cells.slice(i, i + 10));

  const open = life.stories.find((s) => s.id === openId) ?? null;
  const progress = useAudioState((s) => (open && isSameTrack(s.track, trackOf(open)) ? Math.round(((s.time - open.start) / Math.max(1, open.duration)) * 30) / 30 : 0));
  const { lit } = parseMentionState(useMentionState(open));
  const highlight = entity ?? (lit.size ? [...lit][lit.size - 1] : null);
  const related = highlight ? new Set(life.entities.find((e) => e.id === highlight)?.storyIds ?? []) : null;
  const undated = life.stories.filter((s) => s.year === null);
  const preserved = cells.filter((c) => c.exact.length || c.approximate.some((s) => s.year === c.year)).length;
  const openRow = open && open.year !== null ? rows.findIndex((r) => r.some((c) => c.year === open.year)) : -1;

  const trailYears = related
    ? [...new Set(life.stories.filter((s) => related.has(s.id) && s.year !== null).map((s) => s.year!))].sort((a, b) => a - b)
    : [];

  useEffect(() => {
    const measure = () => {
      const box = grid.current?.getBoundingClientRect();
      if (!box) return;
      const map = new Map<number, { x: number; y: number }>();
      cellRefs.current.forEach((el, year) => {
        const r = el.getBoundingClientRect();
        map.set(year, { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2 });
      });
      setCenters(map);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (grid.current) observer.observe(grid.current);
    return () => observer.disconnect();
  }, [openId]);

  const minutes = Math.round(life.stories.reduce((a, s) => a + s.duration, 0) / 60);

  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6">
      <header className="pt-6 pb-8 sm:pt-12">
        <h1 className="t-display">{life.narrator}</h1>
        <p className="t-meta mt-4 max-w-[46rem]">
          One square for every year since {start}. {preserved} of {cells.length} years hold {life.narrator}’s voice: {life.stories.length} stories, {minutes} minutes.
        </p>
      </header>

      <div ref={grid} className="relative">
        <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible" aria-hidden="true">
          {trailYears.length > 1 && !open && (
            <polyline
              points={trailYears
                .map((y) => centers.get(y))
                .filter(Boolean)
                .map((p) => `${p!.x},${p!.y}`)
                .join(" ")}
              className="animate-rise fill-none stroke-voice"
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
          )}
        </svg>

        <div className="grid max-w-[54rem] grid-cols-[5.5rem_minmax(0,1fr)] gap-x-4 sm:grid-cols-[6.5rem_minmax(0,1fr)_7rem] sm:gap-x-6">
          {rows.map((row, i) => {
            const first = row[0];
            const last = row[row.length - 1];
            const stories = new Set(row.flatMap((c) => [...c.exact, ...c.approximate.filter((s) => s.year === c.year)]).map((s) => s.id));
            return (
              <Fragment key={first.year}>
                <div className="flex flex-col justify-center border-t border-rule py-1.5">
                  {first.age !== null && (
                    <span className="font-serif text-[1.375rem] leading-none">
                      {first.age}–{last.age}
                    </span>
                  )}
                  <span className="t-time mt-1 text-ink-2">
                    {first.year}–{String(last.year).slice(2)}
                  </span>
                </div>
                <div className="grid grid-cols-10 gap-1 border-t border-rule py-1.5">
                  {row.map((cell) => {
                    const exact = cell.exact;
                    const center = cell.approximate.filter((s) => s.year === cell.year);
                    const hatched = cell.approximate.length > 0 && !center.length;
                    const story = exact[0] ?? center[0] ?? null;
                    const inTrail = related ? [...exact, ...center].some((s) => related.has(s.id)) : false;
                    const dim = related ? !inTrail : false;
                    const isOpen = open && story && [...exact, ...center].some((s) => s.id === open.id);
                    const label = story ? `${cell.year}: ${[...exact, ...center].map((s) => `${s.title}, ${whenLabel(s)}`).join("; ")}` : `${cell.year}, no voice preserved`;
                    const content = (
                      <>
                        {(cell.year % 10 === 0 || story) && (
                          <span className={`t-time absolute top-1 left-1.5 text-[0.625rem] ${exact.length ? "text-paper/80" : "text-ink-3"}`}>{String(cell.year).slice(2)}</span>
                        )}
                        {[...exact, ...center].some((x) => x.recordingId === life.latestRecordingId) && (
                          <span aria-hidden="true" className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-voice" />
                        )}
                        {exact.length > 0 && (
                          <span className="absolute inset-x-1.5 bottom-1.5 flex flex-col gap-1 text-paper">
                            {exact.slice(0, 3).map((s) => (
                              <Glyph key={s.id} story={s} width={44} height={exact.length > 1 ? 9 : 20} progress={open?.id === s.id ? progress : 0} />
                            ))}
                          </span>
                        )}
                        {!exact.length && center.length > 0 && (
                          <span className="absolute inset-x-1.5 bottom-1.5 text-ink">
                            <Glyph story={center[0]} width={44} height={18} progress={open?.id === center[0].id ? progress : 0} />
                          </span>
                        )}
                      </>
                    );
                    const look = exact.length
                      ? "bg-ink"
                      : center.length
                        ? "border border-dashed border-ink/60 bg-[repeating-linear-gradient(135deg,transparent_0_5px,color-mix(in_oklab,var(--ink)_9%,transparent)_5px_6px)]"
                        : hatched
                          ? "border border-rule bg-[repeating-linear-gradient(135deg,transparent_0_5px,color-mix(in_oklab,var(--ink)_7%,transparent)_5px_6px)]"
                          : "border border-rule";
                    return story ? (
                      <button
                        key={cell.year}
                        ref={(el) => {
                          if (el) cellRefs.current.set(cell.year, el);
                        }}
                        type="button"
                        onClick={() => setOpenId(isOpen ? null : story.id)}
                        aria-pressed={!!isOpen}
                        aria-label={label}
                        className={`relative aspect-square overflow-hidden rounded-[3px] transition-[opacity,box-shadow] duration-300 ${look} ${
                          isOpen ? "ring-2 ring-voice ring-offset-2 ring-offset-paper" : inTrail ? "ring-2 ring-voice/70 ring-offset-1 ring-offset-paper" : "hover:ring-1 hover:ring-ink/50 hover:ring-offset-1 hover:ring-offset-paper"
                        }`}
                        style={{ opacity: dim ? 0.25 : 1 }}
                      >
                        {content}
                      </button>
                    ) : (
                      <div
                        key={cell.year}
                        ref={(el) => {
                          if (el) cellRefs.current.set(cell.year, el);
                        }}
                        aria-label={label}
                        role="img"
                        className={`relative aspect-square rounded-[3px] ${look}`}
                        style={{ opacity: related ? 0.35 : 1 }}
                      >
                        {content}
                      </div>
                    );
                  })}
                  {row.length < 10 && <span className="col-span-full hidden" />}
                </div>
                <div className="hidden items-center border-t border-rule py-1.5 sm:flex">
                  <span className={`t-small ${stories.size ? "text-ink-2" : "text-ink-3 italic"}`}>
                    {stories.size ? `${stories.size} ${stories.size === 1 ? "story" : "stories"}` : "no voice yet"}
                  </span>
                </div>
                {openRow === i && open && (
                  <div className="col-span-full border-t border-ink/60 py-6 sm:col-start-2 sm:col-end-4">
                    <FragmentOpen story={open} activeEntity={entity} onEntity={setEntity} onClose={() => setOpenId(null)} />
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
      </div>

      {undated.length > 0 && (
        <div className="mt-4 grid max-w-[54rem] grid-cols-[5.5rem_minmax(0,1fr)] gap-x-4 border-t border-rule pt-4 sm:grid-cols-[6.5rem_minmax(0,1fr)_7rem] sm:gap-x-6">
          <span className="t-small text-ink-2">Not placed in time</span>
          <div className="flex flex-wrap gap-3">
            {undated.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setOpenId(openId === s.id ? null : s.id)}
                aria-pressed={openId === s.id}
                className="flex items-center gap-2 rounded-[3px] border border-dotted border-ink/50 px-2 py-1.5 text-ink-2 hover:text-ink"
              >
                <Glyph story={s} width={40} height={16} progress={0} />
                <span className="font-serif text-[0.9375rem]" lang={s.language ?? undefined}>
                  {s.title}
                </span>
              </button>
            ))}
          </div>
          {open && open.year === null && (
            <div className="col-span-full mt-4 border-t border-ink/60 py-6 sm:col-start-2 sm:col-end-4">
              <FragmentOpen story={open} activeEntity={entity} onEntity={setEntity} onClose={() => setOpenId(null)} />
            </div>
          )}
        </div>
      )}

      <div className="mt-6 border-t border-rule pt-5">
        <TrailBar entities={life.entities} activeEntity={entity} onEntity={setEntity} language={life.stories[0]?.language ?? null} limit={8} />
      </div>
    </section>
  );
}
