import type { LifeStage, Provenance, Quote, Theme } from "@/lib/types";

export type Certainty = "exact" | "approximate" | "range" | "stage" | "none";

export type LifeMention = { entityId: string; kind: "person" | "place"; time: number };

export type LifeStory = {
  id: string;
  recordingId: string;
  title: string;
  language: string | null;
  start: number;
  end: number;
  duration: number;
  recordedAt: string;
  label: string | null;
  provenance: Provenance | null;
  lifeStage: LifeStage | null;
  certainty: Certainty;
  year: number | null;
  from: number | null;
  to: number | null;
  quote: Quote | null;
  peaks: number[];
  people: { id: string; name: string }[];
  places: { id: string; name: string }[];
  themes: Theme[];
  mentions: LifeMention[];
};

export type LifeEntity = {
  id: string;
  kind: "person" | "place";
  name: string;
  relation: string | null;
  storyIds: string[];
};

export type Life = {
  narrator: string;
  birthYear: number | null;
  now: number;
  latestRecordingId: string | null;
  stories: LifeStory[];
  entities: LifeEntity[];
};

export const STAGE_SPANS: Record<LifeStage, [number, number]> = {
  childhood: [0, 12],
  youth: [13, 25],
  adulthood: [26, 59],
  later_life: [60, 110],
};
