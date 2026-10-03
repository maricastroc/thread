"use client";

import { useId } from "react";
import { heardAt } from "@/components/audio/AudioProvider";
import type { LifeStory } from "@/lib/life";

function smooth(values: number[], radius = 1): number[] {
  return values.map((_, i) => {
    let sum = 0;
    let count = 0;
    for (let k = i - radius; k <= i + radius; k++) {
      if (k < 0 || k >= values.length) continue;
      sum += values[k];
      count++;
    }
    return count ? sum / count : 0;
  });
}

type BarsProps = { story: LifeStory; width: number; height: number; progress?: number; heard?: string; rest?: boolean };

export function Bars({ story, width, height, progress = 0, heard, rest = false }: BarsProps) {
  const bar = 2;
  const gap = 1.5;
  const count = Math.max(6, Math.floor(width / (bar + gap)));
  const step = story.peaks.length / count;
  const raw = Array.from({ length: count }, (_, i) => {
    let max = 0;
    for (let k = Math.floor(i * step); k < Math.floor((i + 1) * step) && k < story.peaks.length; k++) max = Math.max(max, story.peaks[k]);
    return max;
  });
  const low = Math.min(...raw);
  const high = Math.max(...raw);
  const values = high - low < 0.05 ? raw : raw.map((v) => 0.18 + 0.82 * ((v - low) / (high - low)) ** 1.35);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${count * (bar + gap)} ${height}`} preserveAspectRatio="none" aria-hidden="true" className="block">
      {values.map((p, i) => {
        const h = Math.round(Math.max(2, p * height) * 100) / 100;
        const tone = progress > 0 && i / count < progress ? "fill-voice" : !rest ? "fill-current" : heardAt(heard, (i + 0.5) / count) ? "fill-wave-heard" : "fill-wave";
        return <rect key={i} x={i * (bar + gap)} y={height - h} width={bar} height={h} rx={1} className={tone} />;
      })}
    </svg>
  );
}

export function Envelope({ story, width, height, progress = 0 }: { story: LifeStory; width: number; height: number; progress?: number }) {
  const clip = useId().replace(/:/g, "");
  const values = smooth(story.peaks.length ? story.peaks : [0.1, 0.1], 1);
  const n = values.length;
  const points = values.map((v, i) => [(i / (n - 1)) * width, height - Math.max(1, v * height)] as const);
  const d = `M 0 ${height} ${points.map(([x, y]) => `L ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")} L ${width} ${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="block overflow-visible">
      <defs>
        <clipPath id={clip}>
          <rect x={0} y={0} width={progress * width} height={height} />
        </clipPath>
      </defs>
      <path d={d} className="fill-current" />
      {progress > 0 && <path d={d} className="fill-voice" clipPath={`url(#${clip})`} />}
    </svg>
  );
}

export function Rhythm({ story, width, height = 4, progress = 0 }: { story: LifeStory; width: number; height?: number; progress?: number }) {
  const runs = story.rhythm.length ? story.rhythm : [[0, 1] as [number, number]];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="block overflow-visible">
      {runs.map(([a, b], i) => {
        const x = a * width;
        const w = Math.max(1.5, (b - a) * width - 0.75);
        const played = progress > 0 && a < progress;
        return <rect key={i} x={x} y={0} width={w} height={height} rx={height / 2} className={played ? "fill-voice" : "fill-current"} />;
      })}
    </svg>
  );
}

export function Vestige({
  story,
  width,
  state,
  progress = 0,
  tall = 28,
}: {
  story: LifeStory;
  width: number;
  state: "rest" | "near" | "open";
  progress?: number;
  tall?: number;
}) {
  const near = state !== "rest";
  return (
    <span className="relative block" style={{ width, height: tall }}>
      <span
        className="absolute inset-x-0 bottom-[3px] block origin-bottom transition-[transform,opacity] duration-300 ease-[var(--ease-calm)]"
        style={{ transform: `scaleY(${near ? 1 : 0.18})`, opacity: near ? 1 : 0 }}
      >
        <Envelope story={story} width={width} height={tall - 6} progress={progress} />
      </span>
      <span className="absolute inset-x-0 bottom-0 block transition-opacity duration-300" style={{ opacity: near ? 0.35 : 1 }}>
        <Rhythm story={story} width={width} height={3} progress={progress} />
      </span>
    </span>
  );
}
