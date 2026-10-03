"use client";

import { useEffect, useRef } from "react";

type Props = {
  analyser: AnalyserNode | null;
  active: boolean;
  className?: string;
};

const BAR = 3;
const GAP = 3;

export function LevelMeter({ analyser, active, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const levels = useRef<number[]>([]);
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const data = new Float32Array(analyser.fftSize);
    let frame = 0;
    let last = 0;
    const style = getComputedStyle(canvas);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      const ratio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
      }
      const capacity = Math.floor(width / (BAR + GAP));
      if (now - last > 70) {
        last = now;
        analyser.getFloatTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        const rms = Math.sqrt(sum / data.length);
        const level = activeRef.current ? Math.min(1, Math.sqrt(rms * 6)) : 0;
        levels.current.push(level);
        if (levels.current.length > capacity) levels.current.splice(0, levels.current.length - capacity);
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      const color = style.getPropertyValue("--meter") || style.color;
      const values = levels.current;
      if (reduce) {
        const level = values[values.length - 1] ?? 0;
        context.fillStyle = color;
        context.globalAlpha = 0.2;
        context.beginPath();
        context.roundRect(0, height / 2 - 3, width, 6, 3);
        context.fill();
        context.globalAlpha = 1;
        context.beginPath();
        context.roundRect(0, height / 2 - 3, Math.max(6, level * width), 6, 3);
        context.fill();
        return;
      }
      for (let i = 0; i < values.length; i++) {
        const x = width - (values.length - i) * (BAR + GAP);
        const h = Math.max(2, values[i] * height);
        context.globalAlpha = 0.35 + 0.65 * (i / Math.max(1, values.length - 1));
        context.fillStyle = color;
        context.beginPath();
        context.roundRect(x, (height - h) / 2, BAR, h, 1.5);
        context.fill();
      }
      context.globalAlpha = 1;
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [analyser]);

  return <canvas ref={canvasRef} aria-hidden="true" className={className} />;
}
