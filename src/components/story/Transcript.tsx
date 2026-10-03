"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isSameTrack, useAudio, useAudioState, type Track } from "@/components/audio/AudioProvider";
import { formatClock } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { ViewNote, ViewParagraph } from "@/lib/story-view";
import { Note } from "./Note";

type Props = {
  track: Track;
  paragraphs: ViewParagraph[];
  language: string | null;
  offset: number;
};

type ParagraphProps = {
  paragraph: ViewParagraph;
  index: number;
  activeWord: number | null;
  activeTime: number | null;
  dimmed: boolean;
  hovered: number | null;
  language: string | null;
  offset: number;
  onSeek: (time: number) => void;
  onHover: (id: number | null) => void;
  register: (index: number, el: HTMLElement | null) => void;
};

const LIT_SECONDS = 4;

const Paragraph = memo(function Paragraph({
  paragraph,
  index,
  activeWord,
  activeTime,
  dimmed,
  hovered,
  language,
  offset,
  onSeek,
  onHover,
  register,
}: ParagraphProps) {
  const active = activeWord !== null;
  const progress =
    active && activeTime !== null ? Math.min(1, Math.max(0, (activeTime - paragraph.start) / Math.max(0.1, paragraph.end - paragraph.start))) : 0;
  const notes = paragraph.notes;

  return (
    <div
      ref={(el) => register(index, el)}
      className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-3 py-3 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-x-6 lg:grid-cols-[4.5rem_minmax(0,38rem)_minmax(0,1fr)] lg:gap-x-10"
    >
      <div className="relative pt-[0.45rem]">
        <button
          type="button"
          onClick={() => onSeek(paragraph.start)}
          aria-label={t.story.playMoment(formatClock(paragraph.start - offset))}
          className={`t-time inline-flex min-h-8 items-center rounded-sm px-1 -ml-1 transition-colors ${
            active ? "text-voice" : "text-ink-2 hover:text-ink"
          }`}
        >
          {formatClock(paragraph.start - offset)}
        </button>
        <span aria-hidden="true" className="absolute top-2 right-0 bottom-1 w-[2px] overflow-hidden rounded-full bg-transparent sm:right-1">
          <span
            className="block h-full w-full origin-top bg-voice transition-transform duration-300 ease-linear"
            style={{ transform: `scaleY(${progress})`, opacity: active ? 1 : 0 }}
          />
        </span>
      </div>

      <p
        lang={language ?? undefined}
        className={`t-reading transition-colors duration-500 ${dimmed && !active ? "text-ink-2" : "text-ink"}`}
      >
        {paragraph.words.map((word, wi) => {
          const mentioned = word.m?.length;
          const lit = hovered !== null && word.m?.includes(hovered);
          const spoken = active && wi <= activeWord!;
          const current = active && wi === activeWord;
          const next = paragraph.words[wi + 1];
          const joined = !!next && !!word.m && !!next.m && word.m.some((id) => next.m!.includes(id));
          const space = wi < paragraph.words.length - 1 ? " " : "";
          return (
            <span key={wi}>
              <span
                onClick={() => onSeek(word.t)}
                title={word.u ? t.story.uncertain : undefined}
                className={`cursor-pointer transition-colors duration-200 ${
                  current ? "bg-voice-soft" : lit ? "bg-voice-soft" : "hover:bg-ink/[0.05]"
                } ${active && !spoken ? "text-ink-2" : ""} ${
                  mentioned ? "underline decoration-rule-2 decoration-1 underline-offset-[0.24em]" : ""
                } ${word.u ? "underline decoration-ink-3 decoration-dashed decoration-1 underline-offset-[0.3em]" : ""}`}
              >
                {word.x}
                {joined ? space : ""}
              </span>
              {joined ? "" : space}
            </span>
          );
        })}
      </p>

      {notes.length > 0 && (
        <div className="col-start-2 mt-3 border-l border-rule pl-3 lg:col-start-3 lg:mt-0 lg:border-l-0 lg:pt-1 lg:pl-0">
          {notes.map((note: ViewNote) => (
            <Note
              key={note.id}
              note={note}
              language={language}
              offset={offset}
              onPlay={onSeek}
              onHover={onHover}
              highlighted={hovered === note.id}
              lit={activeTime !== null && note.start !== null && activeTime >= note.start - 0.2 && activeTime <= note.start + LIT_SECONDS}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export function Transcript({ track, paragraphs, language, offset }: Props) {
  const { play, seek, store } = useAudio();
  const refs = useRef<(HTMLElement | null)[]>([]);
  const [hovered, setHovered] = useState<number | null>(null);
  const [follow, setFollow] = useState(true);

  const flat = useMemo(
    () => paragraphs.flatMap((p, pi) => p.words.map((w, wi) => ({ t: w.t, pi, wi }))),
    [paragraphs],
  );

  const position = useAudioState((s) => {
    if (!isSameTrack(s.track, track) || flat.length === 0) return -1;
    if (!s.playing && (s.ended || s.time <= track.start + 0.05)) return -1;
    let lo = 0;
    let hi = flat.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (flat[mid].t <= s.time + 0.04) {
        found = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return found;
  });
  const playing = useAudioState((s) => isSameTrack(s.track, track) && s.playing);
  const activeTime = position >= 0 ? flat[position].t : null;
  const activeParagraph = position >= 0 ? flat[position].pi : -1;
  const activeWord = position >= 0 ? flat[position].wi : -1;

  const onSeek = useCallback(
    (time: number) => {
      const state = store.get();
      if (isSameTrack(state.track, track) && !state.ended) {
        seek(time);
        if (!state.playing) play(track, time);
      } else play(track, time);
      setFollow(true);
    },
    [play, seek, store, track],
  );

  const register = useCallback((index: number, el: HTMLElement | null) => {
    refs.current[index] = el;
  }, []);

  useEffect(() => {
    if (!playing) return;
    const stop = () => setFollow(false);
    const onKey = (e: KeyboardEvent) => {
      if (["PageDown", "PageUp", "Home", "End"].includes(e.key)) stop();
    };
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchmove", stop, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchmove", stop);
      window.removeEventListener("keydown", onKey);
    };
  }, [playing]);

  useEffect(() => {
    if (!playing || !follow || activeParagraph < 0) return;
    const el = refs.current[activeParagraph];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const top = window.innerHeight * 0.18;
    const bottom = window.innerHeight * 0.72;
    if (rect.top < top || rect.top > bottom) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    }
  }, [activeParagraph, follow, playing]);

  const backToVoice = () => {
    setFollow(true);
    const el = refs.current[activeParagraph];
    if (el) el.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  return (
    <div className="relative">
      {paragraphs.map((paragraph, index) => (
        <Paragraph
          key={index}
          index={index}
          paragraph={paragraph}
          activeWord={index === activeParagraph ? activeWord : null}
          activeTime={index === activeParagraph ? activeTime : null}
          dimmed={playing}
          hovered={paragraph.notes.some((n) => n.id === hovered) || paragraph.words.some((w) => hovered !== null && w.m?.includes(hovered)) ? hovered : null}
          language={language}
          offset={offset}
          onSeek={onSeek}
          onHover={setHovered}
          register={register}
        />
      ))}
      {playing && !follow && (
        <div className="pointer-events-none sticky bottom-24 z-30 flex justify-center lg:bottom-6">
          <button
            type="button"
            onClick={backToVoice}
            className="animate-rise pointer-events-auto inline-flex h-11 items-center gap-2 rounded-full border border-rule-2 bg-paper px-5 text-[0.9375rem] shadow-[0_6px_24px_-12px_rgb(0_0_0/0.35)] transition-colors hover:border-ink"
          >
            <span aria-hidden="true" className="size-2 rounded-full bg-voice" />
            {t.story.backToNow}
          </button>
        </div>
      )}
    </div>
  );
}
