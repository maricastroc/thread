import type { LifeStage, Segment, Theme } from "@/lib/types";

export type KnownEntity = { name: string; relation: string | null; aliases: string[] };

export type TranscriptInput = {
  narrator: string;
  recordedAt: string;
  prompt: string | null;
  language: string | null;
  segments: Segment[];
};

export type StoryInput = {
  narrator: string;
  birthYear: number | null;
  recordedAt: string;
  language: string | null;
  title: string;
  segments: Segment[];
  known: { people: KnownEntity[]; places: KnownEntity[] };
  earlier: { title: string; when: string | null }[];
};

export type StoryDraft = {
  firstSegment: number;
  lastSegment: number;
  title: string;
  quoteSegment: number | null;
};

export type ClaimedPerson = { name: string; relation: string; mention: string; segment: number; explicit: boolean };
export type ClaimedPlace = { name: string; mention: string; segment: number; explicit: boolean };
export type ClaimedTime = {
  label: string;
  yearFrom: number | null;
  yearTo: number | null;
  mention: string;
  segment: number;
  explicit: boolean;
  reason: string;
};
export type ClaimedLifeStage = { value: LifeStage; mention: string; segment: number; explicit: boolean };

export type StoryAnnotation = {
  people: ClaimedPerson[];
  places: ClaimedPlace[];
  times: ClaimedTime[];
  lifeStage: ClaimedLifeStage | null;
  themes: Theme[];
  questions: string[];
};

export interface StoryInterpreter {
  readonly model: string;
  findStories(transcript: TranscriptInput): Promise<StoryDraft[]>;
  annotateStory(story: StoryInput): Promise<StoryAnnotation>;
}
