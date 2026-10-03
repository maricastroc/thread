"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatClock, formatDuration, formatTimeOfDay, isToday, formatDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { LiveStory, RecordingSummary, WorkStage } from "@/lib/types";

type Line = { idx: number; start: number; end: number; text: string };

type Status = RecordingSummary & {
  waiting: boolean;
  transcript: { source: "live" | "final"; total: number; lines: Line[] };
  stories: LiveStory[];
  peaks: number[] | null;
};

const ORDER: WorkStage[] = ["preserving", "transcribing", "organizing", "indexing"];
const BAR = 3;
const GAP = 2;

function Wave({ peaks, fill, regions, duration }: { peaks: number[]; fill: number; regions: LiveStory[]; duration: number }) {
  const bars = peaks.length ? peaks : new Array(120).fill(0.06);
  const width = bars.length * (BAR + GAP) - GAP;
  const height = 72;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="block h-[72px] w-full" aria-hidden="true">
        <defs>
          <clipPath id="written">
            <rect x="0" y="0" height={height} width={fill * width} className="transition-[width] duration-700 ease-out" />
          </clipPath>
        </defs>
        {regions.map((r) => (
          <rect
            key={r.id}
            x={(r.start / duration) * width}
            y={0}
            width={Math.max(0, ((r.end - r.start) / duration) * width - 4)}
            height={height}
            className="animate-rise fill-voice/[0.07]"
          />
        ))}
        <g className="text-[var(--wave)]">
          {bars.map((p, i) => {
            const h = Math.max(2, p * (height - 8));
            return <rect key={i} x={i * (BAR + GAP)} y={(height - h) / 2} width={BAR} height={h} rx={1.5} fill="currentColor" />;
          })}
        </g>
        <g clipPath="url(#written)" className="text-[var(--wave-played)]">
          {bars.map((p, i) => {
            const h = Math.max(2, p * (height - 8));
            return <rect key={i} x={i * (BAR + GAP)} y={(height - h) / 2} width={BAR} height={h} rx={1.5} fill="currentColor" />;
          })}
        </g>
      </svg>
      {regions.length > 0 && (
        <div className="relative mt-2 h-5" aria-hidden="true">
          {regions.map((r, i) => (
            <span
              key={r.id}
              className="animate-rise absolute top-0 truncate text-[0.75rem] text-ink-2"
              style={{ left: `${(r.start / duration) * 100}%`, maxWidth: `${((r.end - r.start) / duration) * 100}%`, animationDelay: `${i * 120}ms` }}
            >
              {i + 1}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function StepMark({ state }: { state: "done" | "active" | "pending" | "failed" }) {
  if (state === "done")
    return (
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" className="text-ink">
        <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (state === "active") return <span aria-hidden="true" className="animate-breathe mx-[3px] block size-[10px] rounded-full bg-voice" />;
  if (state === "failed") return <span aria-hidden="true" className="mx-[3px] block size-[10px] rounded-full border-2 border-voice" />;
  return <span aria-hidden="true" className="mx-[3px] block size-[10px] rounded-full border border-rule-2" />;
}

export function RecordingLive({ initial }: { initial: Status }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(initial);
  const [lines, setLines] = useState<Line[]>(initial.transcript.lines);
  const [source, setSource] = useState(initial.transcript.source);
  const [retrying, setRetrying] = useState(false);
  const peaks = useRef<number[] | null>(initial.peaks);
  const linesRef = useRef(lines);
  const sourceRef = useRef(source);

  useEffect(() => {
    linesRef.current = lines;
    sourceRef.current = source;
  }, [lines, source]);

  useEffect(() => {
    if (status.stage === "ready" || status.failedStage) return;
    let cancelled = false;
    let timer: number;
    const poll = async () => {
      try {
        const after = sourceRef.current === "live" ? linesRef.current.length : 0;
        const params = new URLSearchParams({ after: String(after) });
        if (!peaks.current) params.set("peaks", "1");
        const response = await fetch(`/api/recordings/${status.id}?${params}`, { cache: "no-store" });
        if (!response.ok) throw new Error();
        const next = (await response.json()) as Status;
        if (cancelled) return;
        if (next.peaks?.length) peaks.current = next.peaks;
        if (next.transcript.source !== sourceRef.current) {
          setSource(next.transcript.source);
          setLines(next.transcript.lines);
        } else if (next.transcript.source === "live") {
          setLines((current) => [...current, ...next.transcript.lines]);
        } else {
          setLines(next.transcript.lines);
        }
        setStatus(next);
        if (next.stage === "ready") {
          router.refresh();
          return;
        }
        if (next.failedStage) return;
      } catch {}
      timer = window.setTimeout(poll, 900);
    };
    timer = window.setTimeout(poll, 600);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [router, status.failedStage, status.id, status.stage]);

  const retry = async () => {
    setRetrying(true);
    const response = await fetch(`/api/recordings/${status.id}/retry`, { method: "POST" });
    setRetrying(false);
    if (response.ok) setStatus((s) => ({ ...s, failedStage: null, error: null, stage: s.failedStage ?? s.stage, progress: 0 }));
  };

  const duration = status.duration ?? 0;
  const currentIndex = status.stage === "ready" ? ORDER.length : ORDER.indexOf(status.stage as WorkStage);
  const failedIndex = status.failedStage ? ORDER.indexOf(status.failedStage) : -1;
  const writtenUntil = lines.length ? lines[lines.length - 1].end : 0;
  const fill =
    currentIndex > 1 || failedIndex > 1 ? 1 : status.stage === "transcribing" && duration ? Math.min(1, Math.max(writtenUntil / duration, status.progress * 0.98)) : 0;
  const annotating = (() => {
    try {
      return status.detail ? (JSON.parse(status.detail) as { annotating: number; total: number }) : null;
    } catch {
      return null;
    }
  })();
  const when = isToday(status.recordedAt) ? t.processing.today(formatTimeOfDay(status.recordedAt)) : formatDate(status.recordedAt);
  const preview = lines.slice(-3);

  const stepState = (i: number): "done" | "active" | "pending" | "failed" => {
    if (failedIndex === i) return "failed";
    if (failedIndex >= 0) return i < failedIndex ? "done" : "pending";
    if (i < currentIndex) return "done";
    if (i === currentIndex) return "active";
    return "pending";
  };

  return (
    <section className="mx-auto max-w-3xl px-4 pt-8 pb-16 sm:px-6 sm:pt-14">
      <h1 className="t-title">{t.processing.saved}</h1>
      <p className="t-meta mt-4">{t.processing.savedMeta(duration ? formatDuration(duration) : "…", when)}</p>
      {status.prompt && (
        <p className="mt-6 max-w-[34rem] font-serif text-[1.1875rem] leading-snug text-ink-2 italic">
          {t.record.asked}: {status.prompt}
        </p>
      )}

      <div className="mt-10">
        <Wave peaks={peaks.current ?? []} fill={fill} regions={status.stories} duration={duration || 1} />
      </div>

      <ol className="mt-10 space-y-6" aria-label={t.processing.steps.preserving.active}>
        {ORDER.map((stage, i) => {
          const state = stepState(i);
          const label = state === "done" ? t.processing.steps[stage].done : t.processing.steps[stage].active;
          return (
            <li key={stage} className="grid grid-cols-[1.5rem_1fr] gap-x-3" aria-current={state === "active" ? "step" : undefined}>
              <span className="flex h-7 items-center">
                <StepMark state={state} />
              </span>
              <div>
                <p className={`text-[1.125rem] leading-7 ${state === "pending" ? "text-ink-2" : "text-ink"}`}>
                  {label}
                  {state === "active" && stage === "transcribing" && duration > 0 && writtenUntil > 0 && (
                    <span className="t-time ml-3 text-ink-2">{t.processing.transcribingProgress(formatClock(writtenUntil), formatClock(duration))}</span>
                  )}
                  {state === "active" && status.waiting && <span className="t-small ml-3 text-ink-2">{t.processing.waiting}</span>}
                </p>

                {stage === "transcribing" && state === "active" && preview.length > 0 && (
                  <div className="mt-3 border-l-2 border-rule pl-4" aria-live="off">
                    {preview.map((line, k) => (
                      <p
                        key={`${source}-${line.idx}`}
                        lang={status.language ?? undefined}
                        className={`animate-rise font-serif text-[1.125rem] leading-relaxed ${k < preview.length - 1 ? "text-ink-2" : "text-ink"}`}
                      >
                        {line.text}
                        {k === preview.length - 1 && <span aria-hidden="true" className="animate-caret ml-0.5 inline-block h-[1em] w-[2px] translate-y-[0.15em] bg-voice" />}
                      </p>
                    ))}
                  </div>
                )}

                {stage === "organizing" && (state === "active" || state === "done" || state === "failed") && status.stories.length > 0 && (
                  <div className="mt-3">
                    {state === "active" && annotating && (
                      <p className="t-small mb-3 text-ink-2">{t.processing.annotating(annotating.annotating, annotating.total)}</p>
                    )}
                    <ol className="space-y-3">
                      {status.stories.map((story, k) => (
                        <li key={story.id} className="animate-rise grid grid-cols-[1.5rem_1fr] gap-x-2" style={{ animationDelay: `${k * 90}ms` }}>
                          <span className="t-time pt-1 text-ink-2">{k + 1}</span>
                          <div>
                            <p className="font-serif text-[1.25rem] leading-snug" lang={status.language ?? undefined}>
                              {story.title}
                            </p>
                            {story.annotated && (story.people.length > 0 || story.places.length > 0 || story.when) && (
                              <p className="t-small animate-rise mt-1 text-ink-2" lang={status.language ?? undefined}>
                                {[story.when?.provenance === "inferred" ? `[${story.when.label}]` : story.when?.label, ...story.people, ...story.places]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {state === "failed" && status.failedStage && (
                  <div role="alert" className="mt-3 max-w-[32rem]">
                    <p className="text-[1.0625rem]">{t.processing.failed[status.failedStage]}</p>
                    <p className="mt-1 text-[1.0625rem] text-ink-2">{t.processing.safe}</p>
                    <button
                      type="button"
                      onClick={retry}
                      disabled={retrying}
                      className="mt-4 inline-flex h-12 items-center rounded-full bg-ink px-6 text-paper disabled:opacity-60"
                    >
                      {retrying ? t.processing.retrying : t.processing.retry}
                    </button>
                    {status.error && (
                      <details className="mt-4">
                        <summary className="t-small inline-flex min-h-11 cursor-pointer items-center text-ink-2 hover:text-ink">
                          {t.processing.technical}
                        </summary>
                        <pre className="t-small mt-2 max-h-60 overflow-auto rounded-md border border-rule bg-paper-raised p-3 font-mono whitespace-pre-wrap text-ink-2">
                          {status.error.message}
                          {status.error.detail ? `\n\n${status.error.detail}` : ""}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {status.stage !== "ready" && !status.failedStage && <p className="t-small mt-12 text-ink-2">{t.processing.leave}</p>}
    </section>
  );
}
