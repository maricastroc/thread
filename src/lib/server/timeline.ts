import "server-only";
import type { StorySummary } from "@/lib/types";
import { slicePeaks } from "./peaks";
import { getPeaks } from "./repo";
import { sortYear } from "./when";

export type TimelineEntry = { story: StorySummary; peaks: number[]; year: number | null };
export type TimelineGroup = { key: string; decade: number | null; entries: TimelineEntry[] };

export function peaksForStories(stories: StorySummary[], buckets: number): Map<string, number[]> {
  const cache = new Map<string, Uint8Array | null>();
  const result = new Map<string, number[]>();
  for (const story of stories) {
    if (!cache.has(story.recordingId)) cache.set(story.recordingId, getPeaks(story.recordingId));
    result.set(story.id, slicePeaks(cache.get(story.recordingId) ?? null, story.start, story.end, buckets));
  }
  return result;
}

export function buildTimeline(stories: StorySummary[]): TimelineGroup[] {
  const peaks = peaksForStories(stories, 44);
  const entries = stories.map((story) => ({ story, peaks: peaks.get(story.id) ?? [], year: sortYear(story.when) }));
  const dated = entries
    .filter((e) => e.year !== null)
    .sort((a, b) => a.year! - b.year! || a.story.recordedAt.localeCompare(b.story.recordedAt) || a.story.ord - b.story.ord);
  const undated = entries
    .filter((e) => e.year === null)
    .sort((a, b) => a.story.recordedAt.localeCompare(b.story.recordedAt) || a.story.ord - b.story.ord);

  const groups: TimelineGroup[] = [];
  for (const entry of dated) {
    const decade = Math.floor(entry.year! / 10) * 10;
    const last = groups[groups.length - 1];
    if (last && last.decade === decade) last.entries.push(entry);
    else groups.push({ key: String(decade), decade, entries: [entry] });
  }
  if (undated.length) groups.push({ key: "undated", decade: null, entries: undated });
  return groups;
}
