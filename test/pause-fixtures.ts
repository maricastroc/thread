import fs from "node:fs";
import type { Segment } from "../src/lib/types";

export type PauseFixture = { name: string; perSecond: number; duration: number; peaks: Uint8Array; segments: Segment[] };

type RawSegment = Omit<Segment, "words"> & { words: [number, number, string, number][] | null };
type RawFixture = { perSecond: number; duration: number; peaks: string; segments: RawSegment[] };

export function loadFixture(name: string): PauseFixture {
  const raw = JSON.parse(fs.readFileSync(new URL(`../fixtures/pauses/${name}.json`, import.meta.url), "utf8")) as RawFixture;
  return {
    name,
    perSecond: raw.perSecond,
    duration: raw.duration,
    peaks: new Uint8Array(Buffer.from(raw.peaks, "base64")),
    segments: raw.segments.map((s) => ({ ...s, words: s.words?.map(([start, end, text, p]) => ({ start, end, text, p })) ?? null })),
  };
}

export function sentenceWith(fixture: PauseFixture, words: string): number {
  const found = fixture.segments.find((s) => s.text.includes(words));
  if (!found) throw new Error(`No sentence with "${words}" in ${fixture.name}`);
  return found.idx;
}

export function transcriptGaps(fixture: PauseFixture): number[] {
  return fixture.segments.slice(1).map((s, i) => s.start - fixture.segments[i].end);
}
