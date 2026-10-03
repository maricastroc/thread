import "server-only";
import type { Segment } from "@/lib/types";
import type { StoryDraft } from "./interpreter/types";

export type PlannedStory = {
  segStart: number;
  segEnd: number;
  start: number;
  end: number;
  title: string;
  quoteSeg: number;
};

const MIN_STORY_SECONDS = 8;
const MAX_GAP_SEGMENTS = 3;
const MAX_GAP_SECONDS = 25;

function cleanTitle(title: string): string {
  return title
    .replace(/^["'“”‘’«»\s]+|["'“”‘’«»\s.]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90);
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function fallbackTitle(segment: Segment): string {
  const words = segment.text.replace(/[.,;:!?…]+$/g, "").split(/\s+/).filter(Boolean);
  return words.length > 7 ? `${words.slice(0, 7).join(" ")}…` : words.join(" ");
}

const QUOTE_MAX_WORDS = 30;

function bestQuote(segments: Segment[], from: number, to: number, preferred: number | null): number {
  if (preferred !== null && preferred >= from && preferred <= to) {
    const words = wordCount(segments[preferred].text);
    if (words >= 4 && words <= QUOTE_MAX_WORDS) return preferred;
  }
  let best = -1;
  for (let i = from; i <= to; i++) {
    const words = wordCount(segments[i].text);
    if (words < 6 || words > QUOTE_MAX_WORDS) continue;
    if (best < 0 || words > wordCount(segments[best].text)) best = i;
  }
  if (best >= 0) return best;
  return preferred !== null && preferred >= from && preferred <= to ? preferred : from;
}

export function planStories(drafts: StoryDraft[], segments: Segment[]): PlannedStory[] {
  if (!segments.length) return [];
  const last = segments.length - 1;
  const ordered = drafts
    .map((d) => {
      let a = Math.max(0, Math.min(last, Math.round(d.firstSegment)));
      let b = Math.max(0, Math.min(last, Math.round(d.lastSegment)));
      if (a > b) [a, b] = [b, a];
      return { ...d, firstSegment: a, lastSegment: b };
    })
    .sort((x, y) => x.firstSegment - y.firstSegment || y.lastSegment - x.lastSegment);

  const kept: StoryDraft[] = [];
  for (const draft of ordered) {
    const previous = kept[kept.length - 1];
    const first = previous && draft.firstSegment <= previous.lastSegment ? previous.lastSegment + 1 : draft.firstSegment;
    if (first > draft.lastSegment) continue;
    kept.push({ ...draft, firstSegment: first });
  }

  for (let i = 1; i < kept.length; i++) {
    const previous = kept[i - 1];
    const current = kept[i];
    const gapStart = previous.lastSegment + 1;
    const gapEnd = current.firstSegment - 1;
    if (gapEnd < gapStart) continue;
    const gapSeconds = segments[gapEnd].end - segments[gapStart].start;
    if (gapEnd - gapStart + 1 > MAX_GAP_SEGMENTS || gapSeconds > MAX_GAP_SECONDS) continue;
    let split = gapEnd + 1;
    for (let s = gapStart; s <= gapEnd; s++) {
      if (segments[s].text.trim().endsWith("?")) {
        split = s;
        break;
      }
    }
    previous.lastSegment = split - 1;
    current.firstSegment = split;
  }

  const first = kept[0];
  if (first && first.firstSegment > 0) {
    for (let s = first.firstSegment - 1; s >= Math.max(0, first.firstSegment - MAX_GAP_SEGMENTS); s--) {
      const text = segments[s].text.trim();
      if (!text.endsWith("?") || text.split(/\s+/).length < 5) break;
      first.firstSegment = s;
    }
  }

  const sized = kept.filter(
    (d) => kept.length === 1 || segments[d.lastSegment].end - segments[d.firstSegment].start >= MIN_STORY_SECONDS,
  );

  const planned = (sized.length ? sized : [{ firstSegment: 0, lastSegment: last, title: "", quoteSegment: null }]).map(
    (d) => {
      const quoteSeg = bestQuote(segments, d.firstSegment, d.lastSegment, d.quoteSegment);
      const title = cleanTitle(d.title) || fallbackTitle(segments[quoteSeg]);
      return {
        segStart: d.firstSegment,
        segEnd: d.lastSegment,
        start: segments[d.firstSegment].start,
        end: segments[d.lastSegment].end,
        title,
        quoteSeg,
      };
    },
  );
  return planned;
}
