import "server-only";
import type { Segment } from "@/lib/types";

export type Pause = { start: number; end: number; duration: number };
export type BoundaryPause = { after: number; duration: number };
export type PauseCue = { after: number; duration: number; ratio: number };
export type PauseEvidence = { typical: number | null; cues: PauseCue[] };

const FLOOR_PERCENTILE = 0.1;
const SPEECH_PERCENTILE = 0.9;
const SILENCE_POSITION = 0.3;
const MIN_DYNAMIC_DB = 6;
const MIN_PAUSE_SECONDS = 0.25;
const BRIDGE_SECONDS = 0.1;
const ALIGN_TOLERANCE_SECONDS = 0.75;
const MIN_PAUSES_FOR_RHYTHM = 5;
const SALIENT_RATIO = 1.5;

function quantile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const position = (sorted.length - 1) * q;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
}

function silentFrames(peaks: ArrayLike<number>): boolean[] | null {
  const levels = Array.from(peaks, (v) => 20 * Math.log10(Math.max((v / 255) ** 2, 1e-4)));
  const floor = quantile(levels, FLOOR_PERCENTILE);
  const speech = quantile(levels, SPEECH_PERCENTILE);
  if (speech - floor < MIN_DYNAMIC_DB) return null;
  const threshold = floor + (speech - floor) * SILENCE_POSITION;
  return levels.map((level) => level < threshold);
}

export function detectPauses(peaks: ArrayLike<number> | null, perSecond: number): Pause[] {
  if (!peaks || peaks.length < perSecond * 2) return [];
  const silent = silentFrames(peaks);
  if (!silent) return [];

  const bridge = Math.round(BRIDGE_SECONDS * perSecond);
  for (let i = 0; i < silent.length; ) {
    if (silent[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j < silent.length && !silent[j]) j++;
    if (i > 0 && j < silent.length && j - i <= bridge) silent.fill(true, i, j);
    i = j;
  }

  const firstSpeech = silent.indexOf(false);
  const lastSpeech = silent.lastIndexOf(false);
  if (firstSpeech < 0) return [];

  const minFrames = Math.round(MIN_PAUSE_SECONDS * perSecond);
  const pauses: Pause[] = [];
  for (let i = firstSpeech; i <= lastSpeech; ) {
    if (!silent[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j <= lastSpeech && silent[j]) j++;
    if (j - i >= minFrames) pauses.push({ start: i / perSecond, end: j / perSecond, duration: (j - i) / perSecond });
    i = j;
  }
  return pauses;
}

function lastWordEnd(segment: Segment): number {
  return segment.words?.length ? segment.words[segment.words.length - 1].end : segment.end;
}

function firstWordStart(segment: Segment): number {
  return segment.words?.length ? segment.words[0].start : segment.start;
}

export function boundaryPauses(pauses: Pause[], segments: Segment[]): BoundaryPause[] {
  const longest = new Map<number, number>();
  for (const pause of pauses) {
    const center = (pause.start + pause.end) / 2;
    let best: { after: number; distance: number; offset: number } | null = null;
    for (let i = 0; i < segments.length - 1; i++) {
      const a = lastWordEnd(segments[i]);
      const b = firstWordStart(segments[i + 1]);
      const from = Math.min(a, b);
      const to = Math.max(a, b);
      const distance = Math.max(0, from - pause.end, pause.start - to);
      if (distance > ALIGN_TOLERANCE_SECONDS) continue;
      const offset = Math.abs((from + to) / 2 - center);
      if (!best || distance < best.distance || (distance === best.distance && offset < best.offset)) best = { after: segments[i].idx, distance, offset };
    }
    if (best) longest.set(best.after, Math.max(longest.get(best.after) ?? 0, pause.duration));
  }
  return [...longest.entries()].map(([after, duration]) => ({ after, duration })).sort((a, b) => a.after - b.after);
}

export function pauseEvidence(peaks: ArrayLike<number> | null, perSecond: number, segments: Segment[]): PauseEvidence {
  const between = boundaryPauses(detectPauses(peaks, perSecond), segments);
  if (between.length < MIN_PAUSES_FOR_RHYTHM) return { typical: null, cues: [] };
  const typical = quantile(
    between.map((p) => p.duration),
    0.5,
  );
  const cues = between
    .filter((p) => p.duration / typical >= SALIENT_RATIO)
    .map((p) => ({ after: p.after, duration: Math.round(p.duration * 10) / 10, ratio: Math.round((p.duration / typical) * 10) / 10 }));
  return { typical: Math.round(typical * 10) / 10, cues };
}
