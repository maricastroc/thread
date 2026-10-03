import "server-only";
import { LIFE_STAGES, THEMES, type Segment } from "@/lib/types";
import type { KnownEntity, StoryInput, TranscriptInput } from "./types";

export function languageName(code: string | null): string {
  if (!code || code === "auto") return "the same language as the transcript";
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function clock(seconds: number): string {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function transcriptLines(segments: Segment[], withTimes: boolean): string {
  const lines: string[] = [];
  segments.forEach((segment, i) => {
    const previous = segments[i - 1];
    if (previous && segment.start - previous.end >= 2.5) {
      lines.push(`— pause ${Math.round(segment.start - previous.end)} s —`);
    }
    lines.push(withTimes ? `[${segment.idx}] ${clock(segment.start)} ${segment.text}` : `[${segment.idx}] ${segment.text}`);
  });
  return lines.join("\n");
}

export function segmentationSystem(narrator: string, language: string): string {
  return `You are the archivist of a family oral-history collection. You receive the transcript of one recording in which ${narrator} tells memories, sometimes answering questions from a relative. Divide the recording into the distinct stories it contains, so the family can find each one later.

How to divide:
- A story is one continuous stretch about a single memory, event, period, person or place. Start a new story only when the subject clearly changes.
- Prefer fewer, complete stories over many fragments. A story normally lasts at least 20 seconds.
- Use the segment numbers in square brackets. Stories keep the original order and never overlap.
- Leave out talk that is not part of a memory: checking the recorder, greetings, goodbyes, instructions.

For each story:
- first_segment and last_segment: the first and last segment numbers of the story.
- title: a short plain label of 2 to 7 words, written in ${language}, in sentence case (capitalize only the first word and proper names, which keep their capital letters). Write it as a neutral label for an archive, not in the narrator's voice: no "eu", "meu", "seu", "você". Name what the story is about using only words and facts present in the transcript. No invented names, dates or feelings. No quotation marks. No final period.
- quote_segment: the number of one segment inside the story whose words best capture it in the narrator's own voice. You choose a segment; you never rewrite it.`;
}

export function segmentationUser(input: TranscriptInput, language: string, segments: Segment[]): string {
  const lines = [`Narrator: ${input.narrator}`, `Recorded on: ${input.recordedAt.slice(0, 10)}`, `Language of the transcript: ${language}`];
  if (input.prompt) lines.push(`Question asked before recording: "${input.prompt}"`);
  lines.push("", "Transcript (segment number, start time, words):", transcriptLines(segments, true));
  return lines.join("\n");
}

export const segmentationSchema = {
  type: "object",
  properties: {
    stories: {
      type: "array",
      items: {
        type: "object",
        properties: {
          first_segment: { type: "integer" },
          last_segment: { type: "integer" },
          title: { type: "string" },
          quote_segment: { type: "integer" },
        },
        required: ["first_segment", "last_segment", "title", "quote_segment"],
      },
    },
  },
  required: ["stories"],
};

export function annotationSystem(narrator: string, language: string, birthYear: number | null): string {
  const birth = birthYear
    ? `${narrator} was born in ${birthYear}.`
    : `${narrator}'s year of birth is unknown, so do not calculate years from ages.`;
  return `You are the archivist of a family oral-history collection. You are indexing one story told by ${narrator}. You never retell the story and never add information. Everything you record must be traceable to the narrator's words, and anything you deduce must be marked as deduced.

For every item:
- segment: the number of the segment where the evidence appears.
- mention: the exact words from that segment, copied character by character, in the original language. Never translate or paraphrase a mention.
- explicit: true only when the narrator states the information in words; false when you deduce it.

people: every individual person who takes part in or is mentioned in the story, except the narrator. Not groups of people (such as "as freiras" or "os vizinhos").
  name: the name the family would know them by. When the story says their name (for example "a Dona Mocinha"), use that name, even if a relationship word is also said; put the relationship in relation. If the person matches someone in the known list, reuse that exact name (for example "o Zé" becomes "José"). Only when the person has no name in the story, use the relationship word as the name, capitalized, in ${language} (for example "Mãe").
  relation: their relationship to the narrator, in ${language}, when the words state it (for example "marido", "irmã"); otherwise an empty string.
places: named places such as cities, towns, neighborhoods, streets, beaches, rivers, churches, schools and workplaces. Skip unnamed generic places such as "a cozinha". name: a clean place name in ${language}; reuse a name from the known list when it is the same place.
times: when the story happens, at most 3.
  If the narrator says a year, or a number that stands for a year (for example "setenta e oito"), explicit is true and year_from and year_to hold that year.
  If you calculate a year from an age or from other facts, explicit is false and reason explains the calculation in one short English sentence that names the evidence, for example "About eight years old, and born in 1948." ${birth}
  Use the same year in year_from and year_to for a single year, and 0 when a year is unknown. label: a short label in ${language}, such as "1978" or "Natal de 1985".
life_stage: the narrator's stage of life during the story: ${LIFE_STAGES.join(", ")} or unknown. Earlier stories from the same recording may tell you the period, but never copy people, places or years from them into this story.
themes: one to three themes from the allowed list.
questions: up to two short follow-up questions, in English, addressed to ${narrator} as "you", that the family could ask next time. A good question asks about a person, place or event that the story mentions but leaves unexplained, and could lead to a new story. Never ask about something the story already answers, and never ask about trivial details.

Use empty lists when nothing applies.`;
}

function knownLine(list: KnownEntity[]): string {
  if (!list.length) return "none yet";
  return list
    .slice(0, 60)
    .map((e) => {
      const extra = [e.relation, e.aliases.length ? `also: ${e.aliases.slice(0, 4).join(", ")}` : null].filter(Boolean).join("; ");
      return extra ? `${e.name} (${extra})` : e.name;
    })
    .join(", ");
}

export function annotationUser(input: StoryInput, language: string): string {
  const earlier = input.earlier.length
    ? input.earlier.map((e) => (e.when ? `${e.title} (${e.when})` : e.title)).join("; ")
    : "none";
  return [
    `Narrator: ${input.narrator}${input.birthYear ? ` (born ${input.birthYear})` : ""}`,
    `Recorded on: ${input.recordedAt.slice(0, 10)}`,
    `Language of the transcript: ${language}`,
    `Story title: ${input.title}`,
    `Earlier stories in the same recording, for context about the period only: ${earlier}`,
    `Known people in the archive: ${knownLine(input.known.people)}`,
    `Known places in the archive: ${knownLine(input.known.places)}`,
    "",
    "Story transcript:",
    transcriptLines(input.segments, false),
  ].join("\n");
}

const mention = {
  segment: { type: "integer" },
  mention: { type: "string" },
};

export const annotationSchema = {
  type: "object",
  properties: {
    people: {
      type: "array",
      items: {
        type: "object",
        properties: { ...mention, name: { type: "string" }, relation: { type: "string" }, explicit: { type: "boolean" } },
        required: ["segment", "mention", "name", "relation", "explicit"],
      },
    },
    places: {
      type: "array",
      items: {
        type: "object",
        properties: { ...mention, name: { type: "string" }, explicit: { type: "boolean" } },
        required: ["segment", "mention", "name", "explicit"],
      },
    },
    times: {
      type: "array",
      items: {
        type: "object",
        properties: {
          ...mention,
          explicit: { type: "boolean" },
          year_from: { type: "integer" },
          year_to: { type: "integer" },
          label: { type: "string" },
          reason: { type: "string" },
        },
        required: ["segment", "mention", "explicit", "year_from", "year_to", "label", "reason"],
      },
    },
    life_stage: {
      type: "object",
      properties: {
        ...mention,
        value: { type: "string", enum: [...LIFE_STAGES, "unknown"] },
        explicit: { type: "boolean" },
      },
      required: ["segment", "mention", "value", "explicit"],
    },
    themes: { type: "array", items: { type: "string", enum: [...THEMES] } },
    questions: { type: "array", items: { type: "string" } },
  },
  required: ["people", "places", "times", "life_stage", "themes", "questions"],
};
