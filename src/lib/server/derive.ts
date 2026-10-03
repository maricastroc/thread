import "server-only";
import type { Segment } from "@/lib/types";
import { findAges, findDurations, findOffsets } from "./numbers";
import { getMeta, getVault, setMeta } from "./archive";
import { getSegments } from "./evidence";
import { allEntities, allStoryRanges, factsForStories, replaceMarks, type MarkInput } from "./interpretation";
import { locateInSegment, tokens } from "./text";
import { hasProperWord, kinship, leadingWords, ownedKin } from "./words";

const DERIVE_VERSION = "1";
const SAME_MOMENT = 1.5;

type Word = { token: string; upper: boolean; text: string; start: number; end: number; seg: number };
type Entity = { id: string; kind: "person" | "place"; name: string; aliases: string[] };
type Anchor = { year: number; time: number; evidence: string };

function wordsOf(segments: Segment[]): Word[] {
  const words: Word[] = [];
  for (const segment of segments) {
    const list = segment.words?.length ? segment.words : [{ start: segment.start, end: segment.end, text: segment.text, p: 1 }];
    for (const word of list) {
      const clean = word.text.trim().replace(/^[^\p{L}\p{N}]+/u, "");
      for (const token of tokens(word.text)) words.push({ token, upper: /^\p{Lu}/u.test(clean), text: word.text.trim(), start: word.start, end: word.end, seg: segment.idx });
    }
  }
  return words;
}

function bareKinship(name: string): boolean {
  const words = tokens(name).filter((w) => !leadingWords.has(w));
  return words.length === 1 && kinship.has(words[0]);
}

function locate(segment: Segment, phrase: string) {
  const hit = locateInSegment(segment, phrase);
  return { seg: segment.idx, evidence: hit?.evidence ?? phrase, start: hit?.start ?? segment.start, end: hit?.end ?? segment.end };
}

function mentionMarks(story: { id: string; recordingId: string }, words: Word[], entities: Entity[], noted: { entityId: string; start: number }[]): MarkInput[] {
  const marks: MarkInput[] = [];
  const stream = words.map((w) => w.token);
  for (const entity of entities) {
    const kin = bareKinship(entity.name);
    const generic = !kin && !hasProperWord(entity.name);
    const phrases = [entity.name, ...entity.aliases].map((p) => tokens(p).filter((t, i) => i > 0 || !leadingWords.has(t))).filter((p) => p.join("").length >= 2);
    for (const phrase of phrases) {
      for (let i = 0; i + phrase.length <= words.length; i++) {
        if (phrase.some((token, k) => stream[i + k] !== token)) continue;
        const first = words[i];
        const last = words[i + phrase.length - 1];
        const time = first.start;
        if (noted.some((n) => n.entityId === entity.id && Math.abs(n.start - time) < SAME_MOMENT)) continue;
        if (marks.some((m) => m.entityId === entity.id && Math.abs((m.start ?? 0) - time) < SAME_MOMENT)) continue;
        let reason: string | null = null;
        if (kin) {
          if (!ownedKin(stream, i)) reason = "A kinship word without “my”: it may be someone else's relative.";
        } else if (generic) {
          reason = "A common noun, not a name, so it can't identify the same place or person.";
        } else if (!first.upper) {
          reason = "Written in lowercase here, so it may be the common word and not the name.";
        }
        marks.push({
          storyId: story.id,
          recordingId: story.recordingId,
          kind: "mention",
          status: reason ? "refused" : "kept",
          reason,
          entityId: entity.id,
          value: null,
          yearFrom: null,
          yearTo: null,
          anchored: false,
          provenance: reason ? null : "said",
          seg: first.seg,
          evidence: words.slice(i, i + phrase.length).map((w) => w.text).filter((t, k, all) => all.indexOf(t) === k).join(" "),
          start: time,
          end: last.end,
          note: null,
        });
      }
    }
  }
  return marks;
}

function timeMarks(story: { id: string; recordingId: string }, segments: Segment[], birthYear: number | null, now: number, stated: Anchor[]): MarkInput[] {
  const marks: MarkInput[] = [];
  const base = { storyId: story.id, recordingId: story.recordingId, entityId: null, yearTo: null } as const;
  const anchors: Anchor[] = [...stated];
  const relative: { time: number }[] = [];

  for (const segment of segments) {
    for (const age of findAges(segment.text)) {
      const at = locate(segment, age.phrase);
      if (!age.firstPerson) {
        marks.push({ ...base, ...at, kind: "age", status: "refused", reason: "Someone else's age, or the words don't say whose.", value: age.age, yearFrom: null, anchored: false, provenance: null, note: null });
        continue;
      }
      const year = birthYear ? birthYear + age.age : null;
      if (year !== null && year > now) {
        marks.push({ ...base, ...at, kind: "age", status: "refused", reason: "This age would fall after today.", value: age.age, yearFrom: null, anchored: false, provenance: null, note: null });
        continue;
      }
      marks.push({
        ...base,
        ...at,
        kind: "age",
        status: "kept",
        reason: null,
        value: age.age,
        yearFrom: year,
        anchored: year !== null,
        provenance: "said",
        note: year !== null ? `About ${year}: aged ${age.age}, counted from the year of birth, ${birthYear}.` : null,
      });
      if (year !== null) anchors.push({ year, time: at.start, evidence: at.evidence });
    }
    for (const duration of findDurations(segment.text)) {
      const at = locate(segment, duration.phrase);
      relative.push({ time: at.start });
      marks.push({
        ...base,
        ...at,
        kind: "duration",
        status: "kept",
        reason: null,
        value: duration.value,
        yearFrom: null,
        anchored: false,
        provenance: "said",
        note: `A length of ${duration.value} ${duration.value === 1 ? "year" : "years"}; the words don't say when it started.`,
      });
    }
  }

  const offsets = segments.flatMap((segment) => findOffsets(segment.text).map((offset) => ({ offset, at: locate(segment, offset.phrase) })));
  for (const { at } of offsets) relative.push({ time: at.start });
  for (const { offset, at } of offsets) {
    const before = anchors.filter((a) => a.time < at.start).sort((a, b) => b.time - a.time);
    const anchor = before[0];
    let reason: string | null = null;
    if (!anchor) reason = "No year is said before it in this story, so its starting point is unknown.";
    else if (relative.some((r) => r.time > anchor.time && r.time < at.start)) reason = "It follows another relative expression, so its starting point is uncertain.";
    else if (anchor.year + offset.value > now) reason = "It would fall after today.";
    marks.push({
      ...base,
      ...at,
      kind: "offset",
      status: reason ? "refused" : "kept",
      reason,
      value: offset.value,
      yearFrom: reason ? null : anchor!.year + offset.value,
      anchored: !reason,
      provenance: reason ? null : "inferred",
      note: reason ? null : `${offset.value} ${offset.value === 1 ? "year" : "years"} after ${anchor!.year} (“${anchor!.evidence}”).`,
    });
  }
  return marks;
}

export function rederiveArchive(): void {
  const vault = getVault();
  if (!vault) return;
  const now = new Date().getFullYear();
  const stories = allStoryRanges();
  const facts = factsForStories(stories.map((s) => s.id));
  const used = new Set<string>();
  for (const list of facts.values()) for (const f of list) if (f.entityId) used.add(f.entityId);
  const entities: Entity[] = allEntities()
    .filter((e) => used.has(e.id) && (e.kind === "person" || e.kind === "place"))
    .map((e) => ({ id: e.id, kind: e.kind as Entity["kind"], name: e.name, aliases: e.aliases }));
  const byRecording = new Map<string, Segment[]>();
  const marks: MarkInput[] = [];
  for (const story of stories) {
    if (!byRecording.has(story.recordingId)) byRecording.set(story.recordingId, getSegments(story.recordingId));
    const segments = byRecording.get(story.recordingId)!.filter((s) => s.idx >= story.segStart && s.idx <= story.segEnd);
    const own = facts.get(story.id) ?? [];
    const noted = own.filter((f) => f.entityId && f.start !== null).map((f) => ({ entityId: f.entityId!, start: f.start! }));
    const stated: Anchor[] = own
      .filter((f) => f.kind === "time" && f.yearFrom && (f.yearTo === null || f.yearTo === f.yearFrom) && f.start !== null && (f.provenance === "said" || f.provenance === "extracted"))
      .map((f) => ({ year: f.yearFrom!, time: f.start!, evidence: f.evidence ?? String(f.yearFrom) }));
    marks.push(...mentionMarks(story, wordsOf(segments), entities, noted));
    marks.push(...timeMarks(story, segments, vault.birthYear, now, stated));
  }
  replaceMarks(marks);
  setMeta("derive_version", DERIVE_VERSION);
}

export function ensureDerived(): void {
  if (getMeta("derive_version") !== DERIVE_VERSION) rederiveArchive();
}
