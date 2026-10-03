"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ImportButton } from "@/components/ImportButton";
import { formatClock, formatSpokenDuration } from "@/lib/format";
import { t } from "@/lib/i18n";
import { uploadAudio } from "@/lib/upload";
import { LevelMeter } from "./LevelMeter";

type Phase = "idle" | "requesting" | "recording" | "paused" | "saving" | "error";
type ErrorKind = "denied" | "notFound" | "insecure" | "unsupported" | "busy" | "upload" | "unreadable";
type Prompt = { text: string; fromArchive: boolean };

const mimeTypes = ["audio/webm;codecs=opus", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"];

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return mimeTypes.find((type) => MediaRecorder.isTypeSupported(type));
}

function extensionFor(mime: string): string {
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

function errorKind(error: unknown): ErrorKind {
  const name = (error as DOMException)?.name;
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "notFound";
  if (name === "NotReadableError" || name === "AbortError") return "busy";
  return "unsupported";
}

type Props = {
  subject: string;
  prompts: Prompt[];
  initialQuestion: string | null;
};

export function Recorder({ subject, prompts, initialQuestion }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<ErrorKind | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const deck = initialQuestion ? [{ text: initialQuestion, fromArchive: false }, ...prompts] : prompts;
  const [promptIndex, setPromptIndex] = useState(0);
  const [showPrompt, setShowPrompt] = useState(deck.length > 0);

  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const chunks = useRef<Blob[]>([]);
  const blob = useRef<Blob | null>(null);
  const startedAt = useRef<Date>(new Date());
  const accumulated = useRef(0);
  const segmentStart = useRef(0);
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  const prompt = showPrompt ? deck[promptIndex % Math.max(1, deck.length)] : null;
  const busy = phase === "recording" || phase === "paused" || phase === "saving";

  const releaseHardware = useCallback(() => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    void audioContext.current?.close().catch(() => undefined);
    audioContext.current = null;
    setAnalyser(null);
    void wakeLock.current?.release().catch(() => undefined);
    wakeLock.current = null;
  }, []);

  useEffect(() => () => releaseHardware(), [releaseHardware]);

  useEffect(() => {
    if (phase !== "recording") return;
    const id = window.setInterval(() => {
      setElapsed(accumulated.current + (performance.now() - segmentStart.current) / 1000);
    }, 250);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState === "visible" && phase === "recording" && !wakeLock.current && "wakeLock" in navigator) {
        wakeLock.current = await navigator.wakeLock.request("screen").catch(() => null);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [phase]);

  const save = async (audio: Blob) => {
      setPhase("saving");
      setProgress(0);
      setAnnouncement(t.record.saving);
      try {
        const { id } = await uploadAudio(audio, {
          source: "recorded",
          filename: `recording.${extensionFor(audio.type)}`,
          recordedAt: startedAt.current,
          prompt: prompt?.text ?? null,
          onProgress: setProgress,
        });
        blob.current = null;
        router.push(`/recordings/${id}`);
      } catch {
        setError("upload");
        setPhase("error");
        setAnnouncement(t.record.errors.upload.title);
      }
    };

  const start = async () => {
    setError(null);
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError("insecure");
      setPhase("error");
      return;
    }
    const mime = pickMime();
    if (typeof MediaRecorder === "undefined") {
      setError("unsupported");
      setPhase("error");
      return;
    }
    setPhase("requesting");
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
      stream.current = media;
      const context = new AudioContext();
      const node = context.createAnalyser();
      node.fftSize = 2048;
      context.createMediaStreamSource(media).connect(node);
      audioContext.current = context;
      setAnalyser(node);

      const rec = new MediaRecorder(media, mime ? { mimeType: mime, audioBitsPerSecond: 96000 } : undefined);
      chunks.current = [];
      rec.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      rec.onstop = () => {
        const audio = new Blob(chunks.current, { type: rec.mimeType || mime || "audio/webm" });
        blob.current = audio;
        releaseHardware();
        void save(audio);
      };
      recorder.current = rec;
      startedAt.current = new Date();
      accumulated.current = 0;
      segmentStart.current = performance.now();
      setElapsed(0);
      rec.start(1000);
      setPhase("recording");
      setAnnouncement(t.record.recording);
      if ("wakeLock" in navigator) wakeLock.current = await navigator.wakeLock.request("screen").catch(() => null);
    } catch (e) {
      releaseHardware();
      setError(errorKind(e));
      setPhase("error");
    }
  };

  const pause = () => {
    const rec = recorder.current;
    if (!rec || rec.state !== "recording") return;
    rec.pause();
    accumulated.current += (performance.now() - segmentStart.current) / 1000;
    setElapsed(accumulated.current);
    setPhase("paused");
    setAnnouncement(t.record.paused);
  };

  const resume = () => {
    const rec = recorder.current;
    if (!rec || rec.state !== "paused") return;
    rec.resume();
    segmentStart.current = performance.now();
    setPhase("recording");
    setAnnouncement(t.record.recording);
  };

  const finish = () => {
    const rec = recorder.current;
    if (!rec || rec.state === "inactive") return;
    if (rec.state === "recording") accumulated.current += (performance.now() - segmentStart.current) / 1000;
    setElapsed(accumulated.current);
    rec.stop();
  };

  const download = () => {
    if (!blob.current) return;
    const url = URL.createObjectURL(blob.current);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${subject}-${startedAt.current.toISOString().slice(0, 10)}.${extensionFor(blob.current.type)}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const live = phase === "recording" || phase === "paused";
  const errorText = error ? t.record.errors[error] : null;

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-8">
      <header className="flex h-14 items-center justify-between">
        <p className="font-serif text-[1.25rem] tracking-[-0.01em] text-ink-2">{t.record.forArchive(subject)}</p>
        {!busy && (
          <Link href="/" className="-mr-3 inline-flex h-12 items-center rounded-full px-4 text-[1.0625rem] text-ink-2 hover:text-ink">
            {t.record.close}
          </Link>
        )}
      </header>

      <p role="status" aria-live="polite" className="visually-hidden">
        {announcement}
      </p>

      <section className="flex flex-1 flex-col">
        <div className="min-h-[11rem] pt-8 sm:pt-14">
          {prompt && phase !== "error" && (
            <div className={live ? "opacity-70 transition-opacity duration-500" : ""}>
              <p className="text-[1.0625rem] text-ink-2">{prompt.fromArchive ? t.record.fromEarlier : t.record.ideaLabel}</p>
              <p className="mt-3 font-serif text-[clamp(1.75rem,1.3rem+2.2vw,2.5rem)] leading-[1.15] tracking-[-0.015em] text-balance">
                {prompt.text}
              </p>
              {phase === "idle" && (
                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1">
                  {deck.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setPromptIndex((i) => (i + 1) % deck.length)}
                      className="min-h-11 text-[1.0625rem] text-ink underline decoration-rule-2 underline-offset-[0.3em] hover:decoration-ink"
                    >
                      {t.record.anotherQuestion}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPrompt(false)}
                    className="min-h-11 text-[1.0625rem] text-ink-2 underline decoration-rule-2 underline-offset-[0.3em] hover:text-ink hover:decoration-ink"
                  >
                    {t.record.hideQuestion}
                  </button>
                </div>
              )}
            </div>
          )}
          {!prompt && phase === "idle" && deck.length > 0 && (
            <button
              type="button"
              onClick={() => setShowPrompt(true)}
              className="min-h-11 text-[1.0625rem] text-ink-2 underline decoration-rule-2 underline-offset-[0.3em] hover:text-ink"
            >
              {t.record.showQuestion}
            </button>
          )}
          {phase === "error" && errorText && (
            <div role="alert" className="max-w-[28rem]">
              <h1 className="font-serif text-[2rem] leading-tight tracking-[-0.015em]">{errorText.title}</h1>
              <p className="mt-4 text-[1.125rem] leading-relaxed text-ink-2">{errorText.body}</p>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-8 py-10">
          {live && (
            <div className="flex w-full flex-col items-center gap-6">
              <p className="flex items-center gap-2.5 text-[1.125rem]">
                <span
                  aria-hidden="true"
                  className={`inline-block size-3 rounded-full ${phase === "recording" ? "animate-breathe bg-voice" : "border-2 border-ink-2"}`}
                />
                {phase === "recording" ? t.record.recording : t.record.paused}
              </p>
              <p role="timer" aria-label={`${t.record.elapsed}: ${formatSpokenDuration(elapsed)}`} className="font-mono text-[clamp(3.5rem,2.5rem+5vw,5.5rem)] leading-none tracking-[-0.04em] tabular-nums">
                {formatClock(elapsed)}
              </p>
              <LevelMeter
                analyser={analyser}
                active={phase === "recording"}
                className="h-16 w-full max-w-[22rem] text-voice"
              />
            </div>
          )}

          {phase === "saving" && (
            <div className="flex w-full max-w-[22rem] flex-col items-center gap-5 text-center">
              <p className="font-serif text-[2rem] leading-tight">{t.record.saving}</p>
              <p className="font-mono text-[1.25rem] tabular-nums text-ink-2">{formatClock(elapsed)}</p>
              <div className="h-1 w-full overflow-hidden rounded-full bg-rule" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label={t.record.saving}>
                <div className="h-full origin-left bg-ink transition-transform duration-300" style={{ transform: `scaleX(${progress})` }} />
              </div>
            </div>
          )}

          {(phase === "idle" || phase === "requesting") && (
            <button
              type="button"
              onClick={start}
              disabled={phase === "requesting"}
              className="group flex flex-col items-center gap-4 rounded-[2rem] p-2 disabled:opacity-70"
            >
              <span className="flex size-[7.5rem] items-center justify-center rounded-full bg-voice shadow-[0_10px_30px_-12px_var(--accent)] transition-transform duration-150 group-hover:scale-[1.03] group-active:scale-[0.97] sm:size-[8.5rem]">
                <span className="size-10 rounded-full bg-on-voice" />
              </span>
              <span className="text-[1.5rem] font-medium">{t.record.start}</span>
            </button>
          )}

          {live && (
            <div className="flex w-full items-end justify-center gap-6 sm:gap-10">
              <button
                type="button"
                onClick={phase === "recording" ? pause : resume}
                className="flex flex-col items-center gap-3 rounded-[1.5rem] p-2"
              >
                <span className="flex size-[4.5rem] items-center justify-center rounded-full border-2 border-rule-2 transition-colors hover:border-ink">
                  {phase === "recording" ? (
                    <span className="flex gap-1.5">
                      <span className="h-6 w-2 rounded-sm bg-ink" />
                      <span className="h-6 w-2 rounded-sm bg-ink" />
                    </span>
                  ) : (
                    <span className="size-5 rounded-full bg-voice" />
                  )}
                </span>
                <span className="text-[1.125rem]">{phase === "recording" ? t.record.pause : t.record.resume}</span>
              </button>
              <button type="button" onClick={finish} className="group flex flex-col items-center gap-3 rounded-[2rem] p-2">
                <span className="flex size-[7.5rem] items-center justify-center rounded-full bg-ink transition-transform duration-150 group-active:scale-[0.97] sm:size-[8.5rem]">
                  <span className="size-9 rounded-[0.6rem] bg-paper" />
                </span>
                <span className="text-[1.5rem] font-medium">{t.record.stop}</span>
              </button>
            </div>
          )}

          {phase === "error" && (
            <div className="flex flex-col items-center gap-5">
              {error === "upload" ? (
                <>
                  <button
                    type="button"
                    onClick={() => blob.current && save(blob.current)}
                    className="inline-flex h-14 items-center rounded-full bg-ink px-8 text-[1.125rem] font-medium text-paper"
                  >
                    {t.record.errors.tryAgain}
                  </button>
                  <button type="button" onClick={download} className="min-h-11 text-[1.0625rem] underline decoration-rule-2 underline-offset-[0.3em] hover:decoration-ink">
                    {t.record.errors.download}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={start} className="inline-flex h-14 items-center rounded-full bg-ink px-8 text-[1.125rem] font-medium text-paper">
                    {t.record.errors.tryAgain}
                  </button>
                  <ImportButton hint={false} />
                </>
              )}
            </div>
          )}
        </div>

        <p className="min-h-12 text-center text-[1.0625rem] leading-relaxed text-ink-2">
          {phase === "idle" && t.record.startHint}
          {phase === "requesting" && t.record.allowMic}
          {live && t.record.stopHint}
        </p>
      </section>
    </div>
  );
}
