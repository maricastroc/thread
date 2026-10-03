import "server-only";
import type { Certainty, Life, LifeEntity, LifeMention, LifeStory } from "@/lib/life";
import type { Vault } from "@/lib/types";
import { PEAKS_PER_SECOND } from "./audio";
import { factsForStories, getPeaks, listRecordings, listStories } from "./repo";
import { peaksForStories } from "./timeline";

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
  const stories = listStories(vault.birthYear);
  const facts = factsForStories(stories.map((s) => s.id));
  const peaks = peaksForStories(stories, 64);
  const rawPeaks = new Map<string, Uint8Array | null>();
  const entities = new Map<string, LifeEntity>();

  const lifeStories: LifeStory[] = stories.map((story) => {
    const own = facts.get(story.id) ?? [];
    const people = new Map<string, string>();
    const places = new Map<string, string>();
    const mentions: LifeMention[] = [];
    for (const fact of own) {
      if (!fact.entityId || (fact.kind !== "person" && fact.kind !== "place")) continue;
      (fact.kind === "person" ? people : places).set(fact.entityId, fact.value);
      if (fact.start !== null) mentions.push({ entityId: fact.entityId, kind: fact.kind, time: fact.start });
      const entity = entities.get(fact.entityId) ?? {
        id: fact.entityId,
        kind: fact.kind,
        name: fact.value,
        relation: fact.kind === "person" ? fact.detail : null,
        storyIds: [],
      };
      if (!entity.storyIds.includes(story.id)) entity.storyIds.push(story.id);
      entities.set(fact.entityId, entity);
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
      rhythm: (() => {
        if (!rawPeaks.has(story.recordingId)) rawPeaks.set(story.recordingId, getPeaks(story.recordingId));
        return rhythmOf(rawPeaks.get(story.recordingId) ?? null, story.start, story.end);
      })(),
      people: [...people.entries()].map(([id, name]) => ({ id, name })),
      places: [...places.entries()].map(([id, name]) => ({ id, name })),
      themes: story.themes,
      mentions: mentions.sort((a, b) => a.time - b.time),
    };
  });

  const recordings = listRecordings().filter((r) => r.stage === "ready");
  return {
    narrator: vault.narrator,
    birthYear: vault.birthYear,
    now: new Date().getFullYear(),
    latestRecordingId: recordings[0]?.id ?? null,
    stories: lifeStories.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999) || a.recordedAt.localeCompare(b.recordedAt)),
    entities: [...entities.values()].sort((a, b) => b.storyIds.length - a.storyIds.length || a.name.localeCompare(b.name)),
  };
}
