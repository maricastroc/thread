"use client";

import { useId, useRef } from "react";
import { formatClock } from "@/lib/format";
import { isSameTrack, useAudio, useAudioState, useAudioTime, type Track } from "./AudioProvider";

export type Marker = { time: number; label: string };
export type Region = { start: number; end: number; label: string; href?: string };

type Props = {
  track: Track;
  peaks: number[];
  label: string;
  markers?: Marker[];
  regions?: Region[];
  height?: number;
  className?: string;
};

const BAR = 3;
const GAP = 2;

export function Scrubber({ track, peaks, label, markers = [], regions = [], height = 56, className }: Props) {
  const { play, seek } = useAudio();
  const clipId = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const clipRef = useRef<SVGRectElement>(null);
  const headRef = useRef<SVGLineElement>(null);
  const dragging = useRef(false);
  const active = useAudioState((s) => isSameTrack(s.track, track));
  const time = useAudioState((s) => (isSameTrack(s.track, track) ? Math.floor(s.time) : track.start));

  const bars = peaks.length ? peaks : new Array(80).fill(0.08);
  const width = bars.length * (BAR + GAP) - GAP;
  const span = Math.max(0.1, track.end - track.start);

  useAudioTime((t, state) => {
    const fraction = isSameTrack(state.track, track) ? Math.min(1, Math.max(0, (t - track.start) / span)) : 0;
    clipRef.current?.setAttribute("width", String(fraction * width));
    if (headRef.current) {
      headRef.current.setAttribute("x1", String(fraction * width));
      headRef.current.setAttribute("x2", String(fraction * width));
      headRef.current.style.opacity = isSameTrack(state.track, track) && fraction > 0 ? "1" : "0";
    }
  });

  const timeAt = (clientX: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return track.start + fraction * span;
  };

  const goTo = (t: number) => {
    if (active) seek(t);
    else play(track, t);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const steps: Record<string, number> = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5, PageUp: 15, PageDown: -15 };
    if (event.key in steps) {
      event.preventDefault();
      goTo((active ? time : track.start) + steps[event.key]);
    } else if (event.key === "Home") {
      event.preventDefault();
      goTo(track.start);
    } else if (event.key === "End") {
      event.preventDefault();
      goTo(track.end - 1);
    }
  };

  const position = Math.max(0, time - track.start);

  return (
    <div className={className}>
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={Math.round(span)}
        aria-valuenow={Math.round(position)}
        aria-valuetext={`${formatClock(position)} of ${formatClock(span)}`}
        onKeyDown={onKeyDown}
        onPointerDown={(e) => {
          dragging.current = true;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          goTo(timeAt(e.clientX));
        }}
        onPointerMove={(e) => {
          if (dragging.current) seek(timeAt(e.clientX));
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        className="group relative cursor-pointer touch-none select-none rounded-[2px] py-2 outline-offset-4"
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="block h-[var(--h)] w-full"
          style={{ "--h": `${height}px` } as React.CSSProperties}
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <clipPath id={clipId}>
              <rect ref={clipRef} x="0" y="0" width="0" height={height} />
            </clipPath>
          </defs>
          {regions.map((r, i) => {
            const x = ((r.start - track.start) / span) * width;
            const w = ((r.end - r.start) / span) * width;
            return <rect key={i} x={x} y={0} width={Math.max(0, w - 3)} height={height} className="fill-ink/[0.035]" />;
          })}
          <g className="text-[var(--wave)] transition-colors duration-200 group-hover:text-[color-mix(in_oklab,var(--wave),var(--ink)_18%)]">
            {bars.map((p, i) => {
              const h = Math.max(2, p * (height - 6));
              return <rect key={i} x={i * (BAR + GAP)} y={(height - h) / 2} width={BAR} height={h} rx={1.5} fill="currentColor" />;
            })}
          </g>
          <g clipPath={`url(#${clipId})`} className="text-[var(--wave-played)]">
            {bars.map((p, i) => {
              const h = Math.max(2, p * (height - 6));
              return <rect key={i} x={i * (BAR + GAP)} y={(height - h) / 2} width={BAR} height={h} rx={1.5} fill="currentColor" />;
            })}
          </g>
          <line ref={headRef} x1="0" x2="0" y1="0" y2={height} stroke="var(--voice)" strokeWidth={2} vectorEffect="non-scaling-stroke" style={{ opacity: 0 }} />
        </svg>
        {markers.length > 0 && (
          <div className="pointer-events-none relative mt-1.5 h-2" aria-hidden="true">
            {markers.map((m, i) => (
              <span
                key={i}
                title={m.label}
                className="absolute top-0 h-2 w-px bg-ink-3"
                style={{ left: `${((m.time - track.start) / span) * 100}%` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
