"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowIcon } from "@/components/icons";
import { formatClock, formatDuration, formatTimeOfDay, isToday, formatDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { LiveStory, RecordingSummary, WorkStage } from "@/lib/types";
import { RemoveRecording } from "./RemoveRecording";

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

function StepMark({ state }: { state: "done" | "active" | "pending" | "failed" }) {
  if (state === "done")
    return (
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" className="text-ink">
        <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (state === "active") return <span aria-hidden="true" className="animate-breathe mx-[3px] block size-[10px] rounded-full bg-voice" />;
  if (state === "failed") return <span aria-hidden="true" className="mx-[3px] block size-[10px] rounded-full border-2 border-error" />;
  return <span aria-hidden="true" className="mx-[3px] block size-[10px] rounded-full border border-rule-2" />;
}

export function RecordingLive({ initial, removeMessage, subject }: { initial: Status; removeMessage: string; subject?: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(initial);
  const [lines, setLines] = useState<Line[]>(initial.transcript.lines);
  const [source, setSource] = useState(initial.transcript.source);
  const [retrying, setRetrying] = useState(false);
  const [peaks, setPeaks] = useState<number[] | null>(initial.peaks);
  const peaksLoaded = useRef(!!initial.peaks?.length);
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
        if (!peaksLoaded.current) params.set("peaks", "1");
        const response = await fetch(`/api/recordings/${status.id}?${params}`, { cache: "no-store" });
        if (!response.ok) throw new Error();
        const next = (await response.json()) as Status;
        if (cancelled) return;
        if (next.peaks?.length) {
          peaksLoaded.current = true;
          setPeaks(next.peaks);
        }
        if (next.transcript.source !== sourceRef.current) {
          setSource(next.transcript.source);
          setLines(next.transcript.lines);
        } else if (next.transcript.source === "live") {
          setLines((current) => [...current, ...next.transcript.lines]);
        } else {
          setLines(next.transcript.lines);
        }
        setStatus(next);
        if (next.stage === "ready" || next.failedStage) {
          router.refresh();
          return;
        }
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
  const latest = lines.at(-1) ?? null;

  const stepState = (i: number): "done" | "active" | "pending" | "failed" => {
    if (failedIndex === i) return "failed";
    if (failedIndex >= 0) return i < failedIndex ? "done" : "pending";
    if (i < currentIndex) return "done";
    if (i === currentIndex) return "active";
    return "pending";
  };

  const at = (seconds: number) => `${Math.min(100, Math.max(0, (seconds / (duration || 1)) * 100))}%`;
  const storyMeta = (story: LiveStory) =>
    [story.when?.provenance === "inferred" ? `[${story.when.label}]` : story.when?.label, ...story.people, ...story.places].filter(Boolean).join(" · ");

  const failure = status.failedStage && (
    <div role="alert" className="mt-4 max-w-[32rem]">
      <p className="text-[1.0625rem]">{t.processing.failed[status.failedStage]}</p>
      <p className="mt-1 text-[1.0625rem] text-ink-2">{status.failedStage === "preserving" ? t.processing.safeOriginal : t.processing.safe}</p>
      <button type="button" onClick={retry} disabled={retrying} className="mt-4 inline-flex h-12 items-center rounded-full bg-ink px-6 text-paper disabled:opacity-60">
        {retrying ? t.processing.retrying : t.processing.retry}
      </button>
      {status.failedStage === "preserving" && (
        <div className="mt-2">
          <RemoveRecording id={status.id} message={removeMessage} />
        </div>
      )}
      {status.error && (
        <details className="mt-4">
          <summary className="t-small inline-flex min-h-11 cursor-pointer items-center text-ink-2 hover:text-ink">{t.processing.technical}</summary>
          <pre className="t-small mt-2 max-h-60 overflow-auto rounded-md border border-rule bg-paper-raised p-3 font-mono whitespace-pre-wrap text-ink-2 [overflow-wrap:anywhere]">
            {status.error.message}
            {status.error.detail ? `\n\n${status.error.detail}` : ""}
          </pre>
        </details>
      )}
    </div>
  );

  const head = (
    <>
      <nav aria-label="Breadcrumb">
        <Link href="/recordings" className="group inline-flex min-h-11 items-center gap-2 text-[0.9375rem] text-ink-2 hover:text-ink">
          <ArrowIcon direction="left" size={14} className="transition-transform group-hover:-translate-x-0.5" />
          {t.recording.back}
        </Link>
      </nav>
      <header className="mt-6 sm:mt-10 lg:grid lg:grid-cols-[4.5rem_minmax(0,1fr)] lg:gap-x-10">
        <div className="hidden lg:block" />
        <div>
          <p className="t-kicker">{subject ? `${t.recording.kicker} · ${t.processing.archiveOf(subject)}` : t.recording.kicker}</p>
          <h1 className="t-title mt-3">{t.processing.saved}</h1>
          <p className="t-meta mt-4">{duration ? t.processing.savedMeta(formatDuration(duration), when) : when}</p>
          {status.prompt && (
            <p className="mt-5 max-w-[40rem] font-serif text-[1.1875rem] leading-snug text-ink-2 italic">
              {t.record.asked}: {status.prompt}
            </p>
          )}
        </div>
      </header>
    </>
  );

  const leave = status.stage !== "ready" && !status.failedStage && <p className="t-small mt-10 text-ink-2">{t.processing.leave}</p>;

  const caption = (i: number, stage: WorkStage, extra?: React.ReactNode) => {
    const state = stepState(i);
    return (
      <p className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[1rem] ${state === "pending" ? "text-ink-2" : "text-ink"}`}>
        <StepMark state={state} />
        <span>{state === "done" ? t.processing.steps[stage].done : t.processing.steps[stage].active}</span>
        {state === "active" && status.waiting && <span className="t-small text-ink-2">· {t.processing.waiting}</span>}
        {state === "active" && extra}
      </p>
    );
  };

  return (
    <section className="mx-auto max-w-6xl px-4 pt-2 pb-16 sm:px-6 sm:pt-4">
      {head}
      <ol className="mt-10" aria-label={t.processing.label}>
        <li aria-current={stepState(0) === "active" ? "step" : undefined}>
          <div className="relative">
            {peaks?.length ? (
              <SourceWave peaks={peaks} regions={status.stories} duration={duration || 1} />
            ) : (
              <div className="relative h-24" aria-hidden="true">
                <span className="absolute inset-x-0 top-1/2 border-t-2 border-dotted border-rule-2" />
              </div>
            )}
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-4">
            {caption(0, "preserving")}
            {duration > 0 && <span className="t-time text-ink-2">{formatClock(duration)}</span>}
          </div>
          {stepState(0) === "failed" && failure}
        </li>

        <li className="mt-9" aria-current={stepState(1) === "active" ? "step" : undefined}>
          {caption(1, "transcribing", duration > 0 && writtenUntil > 0 && <span className="t-time text-ink-2">{t.processing.transcribingProgress(formatClock(writtenUntil), formatClock(duration))}</span>)}
          <div className="relative mt-3 h-5" aria-hidden="true">
            <span className="absolute inset-x-0 top-1/2 border-t-2 border-dotted border-rule-2" />
            <span className="absolute top-1/2 left-0 h-[2px] -translate-y-1/2 bg-ink transition-[width] duration-700" style={{ width: `${fill * 100}%` }} />
            {lines.map((line) => (
              <span key={`${source}-${line.idx}`} className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-ink" style={{ left: at(line.start) }} />
            ))}
            {stepState(1) === "active" && <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-voice" style={{ left: `${fill * 100}%` }} />}
          </div>
          {latest && (
            <p lang={status.language ?? undefined} className={`mt-3 max-w-[46rem] font-serif text-[1.1875rem] leading-relaxed ${stepState(1) === "active" ? "text-ink" : "text-ink-2"}`} aria-live="off">
              “{latest.text}”
              {stepState(1) === "active" && <span aria-hidden="true" className="animate-caret ml-0.5 inline-block h-[1em] w-[2px] translate-y-[0.15em] bg-voice" />}
            </p>
          )}
          {stepState(1) === "failed" && failure}
        </li>

        <li className="mt-9" aria-current={stepState(2) === "active" ? "step" : undefined}>
          {caption(2, "organizing", annotating && <span className="t-small text-ink-2">· {t.processing.annotating(annotating.annotating, annotating.total)}</span>)}
          <div className="relative mt-3 min-h-16" aria-live="off">
            {status.stories.length === 0 && <span aria-hidden="true" className="absolute inset-x-0 top-2.5 border-t-2 border-dotted border-rule-2" />}
            {status.stories.map((story, k) => (
              <div key={story.id} className="animate-rise absolute top-0 min-w-0" style={{ left: at(story.start), width: `calc(${at(story.end - story.start)} - 4px)` }}>
                <div className={`border-t-2 pt-2 transition-colors duration-500 ${story.annotated ? "border-ink" : "border-voice"}`}>
                  <p className="truncate font-serif text-[1.25rem] leading-snug" lang={status.language ?? undefined}>
                    <span className="t-time mr-2 text-ink-2">{k + 1}</span>
                    {story.title}
                  </p>
                  {story.annotated && storyMeta(story) && (
                    <p className="t-small animate-rise mt-0.5 truncate text-ink-2" lang={status.language ?? undefined}>
                      {storyMeta(story)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
          {stepState(2) === "failed" && failure}
        </li>

        <li className="mt-9" aria-current={stepState(3) === "active" ? "step" : undefined}>
          {caption(3, "indexing")}
          <div className="relative mt-3 h-5" aria-hidden="true">
            {stepState(3) === "done" ? (
              <span className="absolute inset-x-0 top-1/2 h-px bg-ink" />
            ) : (
              <span className="absolute inset-x-0 top-1/2 border-t-2 border-dotted border-rule-2" />
            )}
          </div>
          {stepState(3) === "failed" && failure}
        </li>
      </ol>
      {leave}
    </section>
  );
}

function SourceWave({ peaks, regions, duration }: { peaks: number[]; regions: LiveStory[]; duration: number }) {
  const width = peaks.length * (BAR + GAP) - GAP;
  const height = 96;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="block h-24 w-full" aria-hidden="true">
      {regions.map((r) => (
        <rect
          key={r.id}
          x={(r.start / duration) * width}
          y={0}
          width={Math.max(0, ((r.end - r.start) / duration) * width - 4)}
          height={height}
          className={`animate-rise transition-colors duration-500 ${r.annotated ? "fill-ink/[0.05]" : "fill-voice/[0.09]"}`}
        />
      ))}
      <g className="text-wave-heard">
        {peaks.map((p, i) => {
          const h = Math.max(2, p * (height - 8));
          return <rect key={i} x={i * (BAR + GAP)} y={(height - h) / 2} width={BAR} height={h} rx={1.5} fill="currentColor" />;
        })}
      </g>
    </svg>
  );
}
