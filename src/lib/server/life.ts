import "server-only";
import type { Certainty, Life, LifeEntity, LifeMention, LifeStory } from "@/lib/life";
import type { Vault } from "@/lib/types";
import { factsForStories, listRecordings, listStories } from "./repo";
import { peaksForStories } from "./timeline";

const APPROXIMATE_SPREAD = 2;

export function loadLife(vault: Vault): Life {
  const stories = listStories(vault.birthYear);
  const facts = factsForStories(stories.map((s) => s.id));
  const peaks = peaksForStories(stories, 64);
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
      peaks: peaks.get(story.id) ?? [],
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
