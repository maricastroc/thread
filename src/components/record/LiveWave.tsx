"use client";

import { useEffect, useRef, useState } from "react";

const BAR = 3;
const GAP = 2;
const STEP_MS = 80;
const ROOM_SECONDS = 30;
const CURRENT_SECONDS = 2.5;

type Props = {
  analyser: AnalyserNode | null;
  state: "idle" | "recording" | "paused" | "keeping";
  kept?: number;
  height?: number;
  className?: string;
};

export function LiveWave({ analyser, state, kept = 0, height = 96, className = "" }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!analyser || state !== "recording") return;
    const data = new Float32Array(analyser.fftSize);
    const id = window.setInterval(() => {
      analyser.getFloatTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      const level = Math.min(1, Math.sqrt(Math.sqrt(sum / data.length) * 6));
      setLevels((current) => [...current, level]);
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [analyser, state]);

  const samples = levels.length;
  const capacity = Math.max(1, Math.floor((width + GAP) / (BAR + GAP)));
  const span = Math.max(samples, (ROOM_SECONDS * 1000) / STEP_MS);
  const count = Math.min(capacity, Math.ceil((samples / span) * capacity));
  const recent = samples - (CURRENT_SECONDS * 1000) / STEP_MS;
  const bars = Array.from({ length: count }, (_, i) => {
    const from = Math.floor((i * span) / capacity);
    const to = Math.max(from + 1, Math.floor(((i + 1) * span) / capacity));
    let max = 0;
    for (let k = from; k < to && k < samples; k++) max = Math.max(max, levels[k]);
    return { value: max, end: to };
  });
  const head = count ? count * (BAR + GAP) - GAP : 0;
  const mid = height / 2;

  const tone = (end: number, i: number) => {
    if (state === "keeping") return i / Math.max(1, count) < kept ? "fill-wave-heard" : "fill-wave";
    if (state === "recording" && end > recent) return "fill-voice";
    return "fill-wave-heard";
  };

  return (
    <div ref={box} className={`relative ${className}`} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} aria-hidden="true" className="block overflow-visible">
          <line x1={count ? head + 6 : 0} x2={width} y1={mid} y2={mid} className="stroke-rule-2" strokeWidth={2} strokeLinecap="round" strokeDasharray="0.5 7" />
          {bars.map((bar, i) => {
            const h = Math.round(Math.max(2, bar.value * height) * 100) / 100;
            return <rect key={i} x={i * (BAR + GAP)} y={mid - h / 2} width={BAR} height={h} rx={1.5} className={tone(bar.end, i)} />;
          })}
          {state === "recording" && count > 0 && <line x1={head + 2} x2={head + 2} y1={mid - height * 0.42} y2={mid + height * 0.42} className="stroke-voice" strokeWidth={2} />}
        </svg>
      )}
    </div>
  );
}
