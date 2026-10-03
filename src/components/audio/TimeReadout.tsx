"use client";

import { formatClock } from "@/lib/format";
import { isSameTrack, useAudioState, type Track } from "./AudioProvider";

export function TimeReadout({ track, className = "" }: { track: Track; className?: string }) {
  const elapsed = useAudioState((s) => (isSameTrack(s.track, track) ? Math.max(0, Math.floor(s.time - track.start)) : 0));
  const total = Math.max(0, Math.round(track.end - track.start));
  return (
    <span className={`t-time whitespace-nowrap text-ink-2 ${className}`}>
      <span className="text-ink">{formatClock(elapsed)}</span>
      <span aria-hidden="true"> / </span>
      <span className="visually-hidden"> of </span>
      {formatClock(total)}
    </span>
  );
}
