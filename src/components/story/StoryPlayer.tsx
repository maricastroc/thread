"use client";

import { isSameTrack, useAudio, useAudioState, type Track } from "@/components/audio/AudioProvider";
import { Scrubber, type Marker } from "@/components/audio/Scrubber";
import { TimeReadout } from "@/components/audio/TimeReadout";
import { PauseIcon, PlayIcon } from "@/components/icons";
import { t } from "@/lib/i18n";

type Props = {
  track: Track;
  peaks: number[];
  markers: Marker[];
  className?: string;
};

export function StoryPlayer({ track, peaks, markers, className = "" }: Props) {
  const { play, toggle, store } = useAudio();
  const playing = useAudioState((s) => isSameTrack(s.track, track) && s.playing);
  const started = useAudioState((s) => isSameTrack(s.track, track) && !s.ended && s.time > track.start + 0.2);
  const ended = useAudioState((s) => isSameTrack(s.track, track) && s.ended);
  const loading = useAudioState((s) => isSameTrack(s.track, track) && s.loading && s.playing);

  const onClick = () => {
    const state = store.get();
    if (!isSameTrack(state.track, track) || state.ended) return play(track, track.start);
    toggle();
  };

  const label = playing ? t.story.pause : ended ? t.story.replay : started ? t.story.resume : t.story.listen;

  return (
    <div className={`z-20 bg-paper/95 backdrop-blur-md ${className}`}>
      <div className="flex items-center gap-4 py-3 sm:gap-6">
        <button
          type="button"
          onClick={onClick}
          aria-label={`${label}: ${track.title}`}
          className="group inline-flex h-14 shrink-0 items-center gap-3 rounded-full bg-ink pr-6 pl-5 text-paper transition-[background-color,transform] duration-150 hover:bg-[color-mix(in_oklab,var(--text),var(--canvas)_16%)] active:scale-[0.98]"
        >
          {playing ? <PauseIcon size={18} /> : <PlayIcon size={18} className="translate-x-[1px]" />}
          <span className="text-[1rem] font-medium">{label}</span>
          {loading && <span className="visually-hidden">…</span>}
        </button>
        <Scrubber track={track} peaks={peaks} markers={markers} label={t.story.seek} height={44} className="min-w-0 flex-1" />
        <TimeReadout track={track} className="hidden sm:inline" />
      </div>
    </div>
  );
}
