export const STAGES = ["preserving", "transcribing", "organizing", "indexing", "ready"] as const;
export type Stage = (typeof STAGES)[number];
export type WorkStage = Exclude<Stage, "ready">;

export type Provenance = "said" | "extracted" | "inferred";

export const LIFE_STAGES = ["childhood", "youth", "adulthood", "later_life"] as const;
export type LifeStage = (typeof LIFE_STAGES)[number];

export const THEMES = [
  "childhood",
  "family",
  "love",
  "home",
  "work",
  "moving",
  "hardship",
  "celebration",
  "food",
  "faith",
  "school",
  "friendship",
  "loss",
  "travel",
  "music",
  "land",
] as const;
export type Theme = (typeof THEMES)[number];

export type FactKind = "person" | "place" | "time" | "life_stage";
export type EntityKind = "person" | "place";

export type Word = { start: number; end: number; text: string; p: number };

export type Segment = {
  idx: number;
  start: number;
  end: number;
  text: string;
  words: Word[] | null;
  confidence: number | null;
};

export type Fact = {
  id: number;
  storyId: string;
  recordingId: string;
  kind: FactKind;
  entityId: string | null;
  value: string;
  detail: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  provenance: Provenance;
  seg: number | null;
  evidence: string | null;
  start: number | null;
  end: number | null;
  note: string | null;
};

export type When = {
  label: string;
  yearFrom: number | null;
  yearTo: number | null;
  provenance: Provenance;
  lifeStage: LifeStage | null;
};

export type Vault = {
  subject: string;
  birthYear: number | null;
  language: string;
};

export type RecordingSummary = {
  id: string;
  source: "recorded" | "imported";
  recordedAt: string;
  duration: number | null;
  prompt: string | null;
  stage: Stage;
  progress: number;
  detail: string | null;
  failedStage: WorkStage | null;
  error: { message: string; detail: string } | null;
  language: string | null;
  createdAt: string;
  originalName: string | null;
};

export type Quote = { seg: number; text: string; start: number; end: number };

export type StorySummary = {
  id: string;
  recordingId: string;
  ord: number;
  title: string;
  titleBy: "archive" | "family";
  start: number;
  end: number;
  quote: Quote | null;
  when: When | null;
  themes: Theme[];
  language: string | null;
  recordedAt: string;
};

export type EntitySummary = {
  id: string;
  kind: EntityKind;
  name: string;
  relation: string | null;
  storyCount: number;
  momentCount: number;
};

export type Moment = {
  recordingId: string;
  storyId: string | null;
  storyTitle: string | null;
  start: number;
  end: number;
  storyStart: number;
  storyEnd: number;
  text: string;
  before: string | null;
  after: string | null;
  language: string | null;
  when: When | null;
  highlight: string[];
};

export type LiveStory = {
  id: string;
  ord: number;
  title: string;
  start: number;
  end: number;
  annotated: boolean;
  people: string[];
  places: string[];
  when: When | null;
};

export type RecordingStatus = RecordingSummary & {
  segments: Pick<Segment, "idx" | "start" | "end" | "text">[];
  stories: LiveStory[];
  peaks: number[] | null;
};
