import "server-only";
import type { Certainty, Life, LifeEntity, LifeEvent, LifeMention, LifeStory } from "@/lib/life";
import type { StorySummary, Vault } from "@/lib/types";
import { PEAKS_PER_SECOND } from "./audio";
import { ensureDerived } from "./derive";
import { getPeaks, listRecordings } from "./evidence";
import { allEntities, factsForStories, keptMarks, listStories, questionsForStories } from "./interpretation";
import { slicePeaks } from "./peaks";
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

const APPROXIMATE_SPREAD = 2;
const VOICE_THRESHOLD = 0.2;
const MERGE_PAUSE = 0.35;
const MIN_RUN = 0.2;

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

export function loadLife(vault: Vault): Life {
  ensureDerived();
  const now = new Date().getFullYear();
  const stories = listStories(vault.birthYear);
  const facts = factsForStories(stories.map((s) => s.id));
  const questions = questionsForStories(stories.map((s) => s.id));
  const peaks = peaksForStories(stories, 64);
  const rawPeaks = new Map<string, Uint8Array | null>();
  const entities = new Map<string, LifeEntity>();
  const marks = keptMarks();

  const knownById = new Map(allEntities().map((e) => [e.id, e]));

  const lifeStories: LifeStory[] = stories.map((story) => {
    const own = facts.get(story.id) ?? [];
    const ownMarks = marks.filter((m) => m.storyId === story.id);
    const mentions: LifeMention[] = [];
    for (const fact of own) {
      if (!fact.entityId || (fact.kind !== "person" && fact.kind !== "place") || fact.start === null) continue;
      mentions.push({ entityId: fact.entityId, kind: fact.kind, time: fact.start });
    }
    for (const mark of ownMarks) {
      if (mark.kind !== "mention" || !mark.entityId || mark.start === null) continue;
      const entity = knownById.get(mark.entityId);
      if (entity && (entity.kind === "person" || entity.kind === "place")) mentions.push({ entityId: mark.entityId, kind: entity.kind, time: mark.start });
    }
    mentions.sort((a, b) => a.time - b.time);
    const events: LifeEvent[] = ownMarks
      .filter((m) => m.kind !== "mention" && m.start !== null && m.value !== null)
      .map((m) => ({
        kind: m.kind as LifeEvent["kind"],
        time: m.start!,
        evidence: m.evidence ?? "",
        value: m.value!,
        year: m.yearFrom,
        anchored: m.anchored,
        note: m.note,
      }))
      .sort((a, b) => a.time - b.time);

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
      events,
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
