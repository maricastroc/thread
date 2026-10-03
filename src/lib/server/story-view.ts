import "server-only";
import type { Fact, Segment } from "@/lib/types";
import type { ViewNote, ViewParagraph, ViewWord } from "@/lib/story-view";

const PARAGRAPH_GAP = 1.8;
const PARAGRAPH_SENTENCES = 4;
const PARAGRAPH_WORDS = 70;
const UNCERTAIN = 0.4;

function wordsOf(segment: Segment): ViewWord[] {
  if (segment.words?.length) {
    return segment.words.map((w) => ({ t: w.start, e: w.end, x: w.text, ...(w.p < UNCERTAIN ? { u: true } : {}) }));
  }
  const pieces = segment.text.split(/\s+/).filter(Boolean);
  const span = (segment.end - segment.start) / Math.max(1, pieces.length);
  return pieces.map((x, i) => ({ t: segment.start + i * span, e: segment.start + (i + 1) * span, x }));
}

export function toNote(fact: Fact, entityHref: (fact: Fact) => string | null): ViewNote {
  return {
    id: fact.id,
    kind: fact.kind,
    value: fact.value,
    detail: fact.detail,
    provenance: fact.provenance,
    evidence: fact.evidence,
    start: fact.start,
    note: fact.note,
    href: entityHref(fact),
  };
}

export function entityHref(fact: Fact): string | null {
  if (!fact.entityId) return null;
  return fact.kind === "person" ? `/people/${fact.entityId}` : fact.kind === "place" ? `/places/${fact.entityId}` : null;
}

export function buildParagraphs(segments: Segment[], facts: (Fact & { primary: boolean })[]): ViewParagraph[] {
  const groups: Segment[][] = [];
  let current: Segment[] = [];
  let words = 0;
  for (const segment of segments) {
    const previous = current[current.length - 1];
    const count = segment.text.split(/\s+/).length;
    const breakHere =
      previous &&
      (segment.start - previous.end >= PARAGRAPH_GAP || current.length >= PARAGRAPH_SENTENCES || words + count > PARAGRAPH_WORDS);
    if (breakHere) {
      groups.push(current);
      current = [];
      words = 0;
    }
    current.push(segment);
    words += count;
  }
  if (current.length) groups.push(current);

  return groups.map((group) => {
    const idx = new Set(group.map((s) => s.idx));
    const words = group.flatMap(wordsOf);
    const own = facts.filter((f) => f.seg !== null && idx.has(f.seg));
    for (const fact of own) {
      if (fact.start === null || fact.end === null || fact.kind === "life_stage") continue;
      for (const word of words) {
        const mid = (word.t + word.e) / 2;
        if (mid >= fact.start - 0.02 && mid <= fact.end + 0.02) word.m = [...(word.m ?? []), fact.id];
      }
    }
    return {
      start: group[0].start,
      end: group[group.length - 1].end,
      words,
      notes: own.filter((f) => f.primary).map((f) => toNote(f, entityHref)),
    };
  });
}
