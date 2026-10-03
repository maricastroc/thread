import "server-only";
import type { Certainty, Life, LifeEntity, LifeEvent, LifeMention, LifeStory } from "@/lib/life";
import type { Segment, Vault } from "@/lib/types";
import { PEAKS_PER_SECOND } from "./audio";
import { findAge, findDuration, findOffset } from "./numbers";
import { allEntities, factsForStories, getPeaks, getSegments, listRecordings, listStories, questionsForStories } from "./repo";
import { locateInSegment, tokens } from "./text";
import { peaksForStories } from "./timeline";

const APPROXIMATE_SPREAD = 2;
const VOICE_THRESHOLD = 0.2;
const MERGE_PAUSE = 0.35;
const MIN_RUN = 0.2;
const MENTION_GAP = 1.5;

function rhythmOf(peaks: Uint8Array | null, start: number, end: number): [number, number][] {
  if (!peaks?.length || end <= start) return [];
  const from = Math.floor(start * PEAKS_PER_SECOND);
  const to = Math.min(peaks.length, Math.ceil(end * PEAKS_PER_SECOND));
  const runs: [number, number][] = [];
  let open: number | null = null;
  for (let i = from; i < to; i++) {
    const active = peaks[i] / 255 >= VOICE_THRESHOLD;
    if (active && open === null) open = i;
    if (!active && open !== null) {
      runs.push([open / PEAKS_PER_SECOND, i / PEAKS_PER_SECOND]);
      open = null;
    }
  }
  if (open !== null) runs.push([open / PEAKS_PER_SECOND, to / PEAKS_PER_SECOND]);
  const merged: [number, number][] = [];
  for (const run of runs) {
    const last = merged[merged.length - 1];
    if (last && run[0] - last[1] < MERGE_PAUSE) last[1] = run[1];
    else merged.push([...run]);
  }
  const span = end - start;
  return merged
    .filter(([a, b]) => b - a >= MIN_RUN)
    .map(([a, b]) => [Math.max(0, (a - start) / span), Math.min(1, (b - start) / span)] as [number, number]);
}

function eventsOf(segments: Segment[], anchor: number | null, birthYear: number | null, now: number): LifeEvent[] {
  const events: LifeEvent[] = [];
  for (const segment of segments) {
    const age = findAge(segment.text);
    if (age && birthYear) {
      const year = birthYear + age.age;
      const hit = locateInSegment(segment, age.phrase);
      if (year <= now) events.push({ kind: "age", time: hit?.start ?? segment.start, evidence: hit?.evidence ?? age.phrase, year, age: age.age });
    }
    if (anchor === null) continue;
    const offset = findOffset(segment.text);
    if (offset && anchor + offset.value <= now) {
      const hit = locateInSegment(segment, offset.phrase);
      events.push({ kind: "offset", time: hit?.start ?? segment.start, evidence: hit?.evidence ?? offset.phrase, year: anchor + offset.value });
    }
    const duration = findDuration(segment.text);
    if (duration && !findAge(segment.text)) {
      const hit = locateInSegment(segment, duration.phrase);
      events.push({
        kind: "duration",
        time: hit?.start ?? segment.start,
        evidence: hit?.evidence ?? duration.phrase,
        year: anchor,
        to: Math.min(now, anchor + duration.value),
      });
    }
  }
  return events.sort((a, b) => a.time - b.time);
}

function expandMentions(
  segments: Segment[],
  known: { id: string; kind: "person" | "place"; phrases: string[][] }[],
  mentions: LifeMention[],
): LifeMention[] {
  const words: { token: string; start: number }[] = [];
  for (const segment of segments) {
    const list = segment.words?.length ? segment.words : [{ start: segment.start, end: segment.end, text: segment.text, p: 1 }];
    for (const word of list) for (const token of tokens(word.text)) words.push({ token, start: word.start });
  }
  const result = [...mentions];
  for (const entity of known) {
    for (const phrase of entity.phrases) {
      if (!phrase.length) continue;
      for (let i = 0; i + phrase.length <= words.length; i++) {
        let ok = true;
        for (let k = 0; k < phrase.length; k++) {
          if (words[i + k].token !== phrase[k]) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        const time = words[i].start;
        if (result.some((m) => m.entityId === entity.id && Math.abs(m.time - time) < MENTION_GAP)) continue;
        result.push({ entityId: entity.id, kind: entity.kind, time });
      }
    }
  }
  return result.sort((a, b) => a.time - b.time);
}

export function loadLife(vault: Vault): Life {
  const now = new Date().getFullYear();
  const stories = listStories(vault.birthYear);
  const facts = factsForStories(stories.map((s) => s.id));
  const questions = questionsForStories(stories.map((s) => s.id));
  const peaks = peaksForStories(stories, 64);
  const rawPeaks = new Map<string, Uint8Array | null>();
  const entities = new Map<string, LifeEntity>();

  const registry = allEntities();
  const used = new Set<string>();
  for (const list of facts.values()) for (const f of list) if (f.entityId) used.add(f.entityId);
  const known = registry
    .filter((e) => used.has(e.id))
    .map((e) => ({
      id: e.id,
      kind: e.kind,
      name: e.name,
      relation: e.relation,
      phrases: [e.name, ...e.aliases].map(tokens).filter((p) => p.join("").length >= 3),
    }));
  const knownById = new Map(known.map((e) => [e.id, e]));

  const lifeStories: LifeStory[] = stories.map((story) => {
    const own = facts.get(story.id) ?? [];
    const segments = getSegments(story.recordingId).filter((s) => s.start >= story.start - 0.05 && s.end <= story.end + 0.05);
    const factMentions: LifeMention[] = [];
    for (const fact of own) {
      if (!fact.entityId || (fact.kind !== "person" && fact.kind !== "place") || fact.start === null) continue;
      factMentions.push({ entityId: fact.entityId, kind: fact.kind, time: fact.start });
    }
    const mentions = expandMentions(segments, known, factMentions);

    const people = new Map<string, string>();
    const places = new Map<string, string>();
    for (const m of mentions) {
      const entity = knownById.get(m.entityId);
      if (!entity) continue;
      (m.kind === "person" ? people : places).set(m.entityId, entity.name);
      const record = entities.get(m.entityId) ?? {
        id: m.entityId,
        kind: entity.kind,
        name: entity.name,
        relation: entity.kind === "person" ? entity.relation : null,
        storyIds: [],
      };
      if (!record.storyIds.includes(story.id)) record.storyIds.push(story.id);
      entities.set(m.entityId, record);
    }

    const when = story.when;
    let certainty: Certainty = "none";
    let year: number | null = null;
    let from: number | null = null;
    let to: number | null = null;
    if (when?.yearFrom) {
      const span = (when.yearTo ?? when.yearFrom) - when.yearFrom;
      if (when.lifeStage && when.provenance === "inferred" && span > 3) {
        certainty = "stage";
        from = when.yearFrom;
        to = when.yearTo ?? when.yearFrom;
        year = Math.round((from + to) / 2);
      } else if (span > 0) {
        certainty = when.provenance === "inferred" ? "approximate" : "range";
        from = when.yearFrom;
        to = when.yearTo ?? when.yearFrom;
        year = Math.round((from + to) / 2);
      } else if (when.provenance === "inferred") {
        certainty = "approximate";
        year = when.yearFrom;
        from = year - APPROXIMATE_SPREAD;
        to = year + APPROXIMATE_SPREAD;
      } else {
        certainty = "exact";
        year = when.yearFrom;
        from = year;
        to = year;
      }
    }

    if (!rawPeaks.has(story.recordingId)) rawPeaks.set(story.recordingId, getPeaks(story.recordingId));

    return {
      id: story.id,
      recordingId: story.recordingId,
      title: story.title,
      language: story.language,
      start: story.start,
      end: story.end,
      duration: story.end - story.start,
      recordedAt: story.recordedAt,
      label: when?.label ?? null,
      provenance: when?.provenance ?? null,
      lifeStage: when?.lifeStage ?? null,
      certainty,
      year,
      from,
      to,
      quote: story.quote,
      age: vault.birthYear && year !== null && year >= vault.birthYear ? year - vault.birthYear : null,
      peaks: peaks.get(story.id) ?? [],
      rhythm: rhythmOf(rawPeaks.get(story.recordingId) ?? null, story.start, story.end),
      people: [...people.entries()].map(([id, name]) => ({ id, name })),
      places: [...places.entries()].map(([id, name]) => ({ id, name })),
      themes: story.themes,
      mentions,
      events: eventsOf(segments, year, vault.birthYear, now),
      questions: questions.get(story.id) ?? [],
    };
  });

  const recordings = listRecordings().filter((r) => r.stage === "ready");
  return {
    narrator: vault.narrator,
    birthYear: vault.birthYear,
    now,
    latestRecordingId: recordings[0]?.id ?? null,
    stories: lifeStories.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999) || a.recordedAt.localeCompare(b.recordedAt)),
    entities: [...entities.values()].sort((a, b) => b.storyIds.length - a.storyIds.length || a.name.localeCompare(b.name)),
  };
}
