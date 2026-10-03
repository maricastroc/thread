"use client";

import { PauseIcon, PlayIcon } from "@/components/icons";
import { t } from "@/lib/i18n";
import { isSameTrack, useAudio, useAudioState, type Track } from "./AudioProvider";

type Props = {
  track: Track;
  from?: number;
  size?: "sm" | "md" | "lg";
  label?: string;
  variant?: "solid" | "outline" | "quiet";
  className?: string;
  children?: React.ReactNode;
};

const sizes = {
  sm: "size-9",
  md: "size-11",
  lg: "size-14",
};

const iconSizes = { sm: 12, md: 14, lg: 18 };

export function usePlaying(track: Track, from?: number) {
  return useAudioState((s) => {
    if (!isSameTrack(s.track, track) || !s.playing) return false;
    if (from === undefined) return true;
    return s.time >= from - 0.5 && s.time < track.end;
  });
}

export function PlayButton({ track, from, size = "md", label, variant = "outline", className = "", children }: Props) {
  const { play, toggle, store } = useAudio();
  const playing = usePlaying(track, from);

  const onClick = () => {
    const state = store.get();
    const same = isSameTrack(state.track, track);
    if (playing) return toggle();
    if (from !== undefined) return play(track, from);
    if (same && !state.ended) return toggle();
    play(track, track.start);
  };

  const look =
    variant === "solid"
      ? "bg-ink text-paper hover:bg-[color-mix(in_oklab,var(--ink),var(--paper)_18%)]"
      : variant === "quiet"
        ? "text-ink hover:bg-ink/[0.06]"
        : "border border-rule-2 text-ink hover:border-ink";

  const name = label ?? track.title;
  if (children) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={playing}
        className={`inline-flex items-center gap-2.5 transition-colors duration-150 ${className}`}
      >
        <span className={`inline-flex shrink-0 items-center justify-center rounded-full ${sizes[size]} ${look}`}>
          {playing ? <PauseIcon size={iconSizes[size]} /> : <PlayIcon size={iconSizes[size]} className="translate-x-[1px]" />}
        </span>
        {children}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={playing ? `${t.player.pause}: ${name}` : `${t.player.play}: ${name}`}
      className={`inline-flex shrink-0 items-center justify-center rounded-full transition-colors duration-150 ${sizes[size]} ${look} ${className}`}
    >
      {playing ? <PauseIcon size={iconSizes[size]} /> : <PlayIcon size={iconSizes[size]} className="translate-x-[1px]" />}
    </button>
  );
}
