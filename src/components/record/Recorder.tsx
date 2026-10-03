"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ImportButton } from "@/components/ImportButton";
import { formatClock, formatSpokenDuration } from "@/lib/format";
import { t } from "@/lib/i18n";
import { uploadAudio } from "@/lib/upload";
import { LiveWave } from "./LiveWave";

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
  const [take, setTake] = useState(0);
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
  const mainButton = useRef<HTMLButtonElement>(null);

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
    if (phase === "recording" && (!document.activeElement || document.activeElement === document.body)) mainButton.current?.focus();
  }, [phase]);

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
      setTake((n) => n + 1);
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
  const waveState = phase === "recording" ? "recording" : phase === "paused" ? "paused" : phase === "saving" ? "keeping" : "idle";
  const hint = phase === "idle" ? t.record.startHint : phase === "requesting" ? t.record.allowMic : live ? t.record.stopHint : null;

  const promptBlock = prompt && phase !== "error" && (
    <div className={`transition-colors duration-500 ${live || phase === "saving" ? "text-ink-2" : "text-ink"}`}>
      <p className="text-[1.0625rem] text-ink-2">{prompt.fromArchive ? t.record.fromEarlier : t.record.ideaLabel}</p>
      <p className="mt-3 max-w-[24ch] font-serif text-[clamp(1.875rem,1.3rem+2.4vw,2.875rem)] leading-[1.12] tracking-[-0.015em] text-balance">
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
  );

  const askAgain = !prompt && phase === "idle" && deck.length > 0 && (
    <button
      type="button"
      onClick={() => setShowPrompt(true)}
      className="min-h-11 text-[1.0625rem] text-ink-2 underline decoration-rule-2 underline-offset-[0.3em] hover:text-ink"
    >
      {t.record.showQuestion}
    </button>
  );

  const errorBlock = phase === "error" && errorText && (
    <div role="alert" className="max-w-120">
      <h1 className="font-serif text-[2rem] leading-tight tracking-[-0.015em]">{errorText.title}</h1>
      <p className="mt-4 text-[1.125rem] leading-relaxed text-ink-2">{errorText.body}</p>
    </div>
  );

  const status = (
    <p className="flex items-center gap-2.5 text-[1.0625rem]">
      {live ? (
        <>
          <span aria-hidden="true" className={`inline-block size-2.5 rounded-full ${phase === "recording" ? "animate-breathe bg-voice" : "border-2 border-ink-2"}`} />
          {phase === "recording" ? t.record.recording : t.record.paused}
        </>
      ) : phase === "saving" ? (
        <span>{t.record.keeping(subject)}</span>
      ) : (
        <span className="text-ink-3 italic">{t.record.noVoice}</span>
      )}
    </p>
  );

  const timer = (live || phase === "saving") && (
    <p
      role="timer"
      aria-label={`${t.record.elapsed}: ${formatSpokenDuration(elapsed)}`}
      className="font-mono text-[clamp(2rem,1.6rem+1.6vw,2.75rem)] leading-none tracking-[-0.03em] tabular-nums"
    >
      {formatClock(elapsed)}
    </p>
  );

  const pill = "inline-flex h-16 items-center gap-3 rounded-full pr-8 pl-6 text-[1.1875rem] font-medium transition-[background-color,border-color,transform] duration-150 active:scale-[0.98]";
  const solid = `${pill} bg-ink text-paper hover:bg-[color-mix(in_oklab,var(--text),var(--canvas)_16%)] disabled:opacity-70`;
  const outline = `${pill} border border-rule-2 text-ink hover:border-ink`;

  const errorControls = phase === "error" && (
    <>
      {error === "upload" ? (
        <>
          <button type="button" onClick={() => blob.current && save(blob.current)} className={solid}>
            {t.record.errors.tryAgain}
          </button>
          <button type="button" onClick={download} className="min-h-11 text-[1.0625rem] underline decoration-rule-2 underline-offset-[0.3em] hover:decoration-ink">
            {t.record.errors.download}
          </button>
        </>
      ) : (
        <>
          <button type="button" onClick={start} className={solid}>
            {t.record.errors.tryAgain}
          </button>
          <ImportButton hint={false} />
        </>
      )}
    </>
  );

  const saving = phase === "saving" && (
    <span role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label={t.record.saving} className="visually-hidden" />
  );

  const header = (
    <header className="flex h-14 items-center justify-between">
      <p className="font-serif text-[1.25rem] tracking-[-0.01em] text-ink-2">{t.record.forArchive(subject)}</p>
      {!busy && (
        <Link href="/" className="-mr-3 inline-flex h-12 items-center rounded-full px-4 text-[1.0625rem] text-ink-2 hover:text-ink">
          {t.record.close}
        </Link>
      )}
    </header>
  );

  const frame = "mx-auto flex min-h-dvh flex-col px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-8";

  const mainControl =
    phase === "idle" || phase === "requesting" ? (
      <button ref={mainButton} type="button" onClick={start} disabled={phase === "requesting"} className={solid}>
        <span aria-hidden="true" className="size-3.5 rounded-full bg-voice" />
        {t.record.start}
      </button>
    ) : live ? (
      <button ref={mainButton} type="button" onClick={finish} className={solid}>
        <span aria-hidden="true" className="size-3.5 rounded-[3px] bg-paper" />
        {t.record.stop}
      </button>
    ) : null;

  const secondary = live && (
    <button type="button" onClick={phase === "recording" ? pause : resume} className={`${outline} h-12 pr-6 pl-4 text-[1.0625rem]`}>
      {phase === "recording" ? (
        <span aria-hidden="true" className="flex gap-1">
          <span className="h-3.5 w-1.5 rounded-[1px] bg-ink" />
          <span className="h-3.5 w-1.5 rounded-[1px] bg-ink" />
        </span>
      ) : (
        <span aria-hidden="true" className="size-3 rounded-full bg-voice" />
      )}
      {phase === "recording" ? t.record.pause : t.record.resume}
    </button>
  );

  return (
    <div className={`${frame} max-w-5xl`}>
      {header}
      <p role="status" aria-live="polite" className="visually-hidden">
        {announcement}
      </p>
      <section className="flex flex-1 flex-col justify-center gap-14 py-10 sm:gap-20">
        <div>
          {promptBlock}
          {askAgain}
          {errorBlock}
        </div>
        <div>
          <div className="mb-4 flex min-h-8 items-end justify-between gap-6">
            {status}
            <span className="sm:hidden">{timer}</span>
          </div>
          <div className="grid grid-cols-1 items-center gap-x-6 gap-y-5 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
            <div className="order-2 flex min-h-16 flex-wrap items-center gap-4 sm:order-1">
              {mainControl}
              {errorControls}
            </div>
            <LiveWave key={take} analyser={analyser} state={waveState} kept={progress} height={112} className="order-1 w-full sm:order-2" />
            <div className="order-3 hidden min-w-[5.5rem] text-right sm:block">{timer}</div>
          </div>
          {saving}
          <div className="mt-5 flex min-h-12 flex-wrap items-center gap-x-6 gap-y-3">
            {secondary}
            {hint && <p className="text-[1.0625rem] leading-relaxed text-ink-2">{hint}</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
