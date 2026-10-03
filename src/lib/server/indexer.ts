import "server-only";
import type { Segment } from "@/lib/types";
import { config } from "./config";
import { db, transaction } from "./db";
import { embed } from "./ollama";

const WINDOW_SECONDS = 28;
const WINDOW_WORDS = 90;
const BATCH = 16;

type Range = { from: number; to: number; storyId: string | null; title: string | null };
type ChunkDraft = { storyId: string | null; title: string | null; segStart: number; segEnd: number; start: number; end: number; text: string };

const searchState = globalThis as unknown as { __cofreSearchVersion?: number };

export function searchVersion(): number {
  return searchState.__cofreSearchVersion ?? 0;
}

function bumpSearchVersion(): void {
  searchState.__cofreSearchVersion = searchVersion() + 1;
}

function ranges(segments: Segment[], stories: { id: string; title: string; segStart: number; segEnd: number }[]): Range[] {
  const result: Range[] = [];
  const sorted = [...stories].sort((a, b) => a.segStart - b.segStart);
  let cursor = 0;
  const last = segments.length - 1;
  for (const story of sorted) {
    if (story.segStart > cursor) result.push({ from: cursor, to: story.segStart - 1, storyId: null, title: null });
    result.push({ from: story.segStart, to: story.segEnd, storyId: story.id, title: story.title });
    cursor = story.segEnd + 1;
  }
  if (cursor <= last) result.push({ from: cursor, to: last, storyId: null, title: null });
  return result;
}

export function buildChunks(segments: Segment[], stories: { id: string; title: string; segStart: number; segEnd: number }[]): ChunkDraft[] {
  const chunks: ChunkDraft[] = [];
  for (const range of ranges(segments, stories)) {
    let i = range.from;
    while (i <= range.to) {
      let j = i;
      let words = 0;
      while (j <= range.to && segments[j].end - segments[i].start < WINDOW_SECONDS && words < WINDOW_WORDS) {
        words += segments[j].text.split(/\s+/).length;
        j++;
      }
      if (j === i) j = i + 1;
      const slice = segments.slice(i, j);
      chunks.push({
        storyId: range.storyId,
        title: range.title,
        segStart: slice[0].idx,
        segEnd: slice[slice.length - 1].idx,
        start: slice[0].start,
        end: slice[slice.length - 1].end,
        text: slice.map((s) => s.text).join(" "),
      });
      if (j > range.to) break;
      i = j - 1 > i ? j - 1 : j;
    }
  }
  return chunks;
}

export function documentText(title: string | null, text: string): string {
  return `title: ${title?.trim() || "none"} | text: ${text}`;
}

export function queryText(query: string): string {
  return `task: search result | query: ${query}`;
}

function toBlob(vector: number[]): Uint8Array {
  let norm = 0;
  for (const v of vector) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  const floats = new Float32Array(vector.length);
  for (let i = 0; i < vector.length; i++) floats[i] = vector[i] / norm;
  return new Uint8Array(floats.buffer);
}

export async function indexRecording(
  recordingId: string,
  segments: Segment[],
  stories: { id: string; title: string; segStart: number; segEnd: number }[],
  onProgress?: (fraction: number) => void,
): Promise<void> {
  const chunks = buildChunks(segments, stories);
  const ids: number[] = [];
  transaction(() => {
    db().prepare("DELETE FROM chunks WHERE recording_id = ?").run(recordingId);
    const insert = db().prepare(
      "INSERT INTO chunks (recording_id, story_id, seg_start, seg_end, start_sec, end_sec, text) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    for (const chunk of chunks) {
      const result = insert.run(recordingId, chunk.storyId, chunk.segStart, chunk.segEnd, chunk.start, chunk.end, chunk.text);
      ids.push(Number(result.lastInsertRowid));
    }
  });
  bumpSearchVersion();

  const update = db().prepare("UPDATE chunks SET embedding = ?, model = ? WHERE id = ?");
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const vectors = await embed(
      config.embeddingModel,
      batch.map((c) => documentText(c.title, c.text)),
    );
    transaction(() => {
      vectors.forEach((vector, k) => update.run(toBlob(vector), config.embeddingModel, ids[i + k]));
    });
    onProgress?.(Math.min(1, (i + batch.length) / chunks.length));
  }
  bumpSearchVersion();
}

export async function embedQuery(query: string): Promise<Float32Array> {
  const [vector] = await embed(config.embeddingModel, [queryText(query)]);
  const blob = toBlob(vector);
  return new Float32Array(blob.buffer);
}
