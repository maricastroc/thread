import "server-only";
import { z } from "zod";
import { LIFE_STAGES, THEMES, type Segment } from "@/lib/types";
import { config } from "../config";
import { chatJson, type ChatStats } from "../ollama";
import { estimateTokens } from "../text";
import {
  annotationSchema,
  annotationSystem,
  annotationUser,
  languageName,
  segmentationSchema,
  segmentationSystem,
  segmentationUser,
} from "./prompts";
import type { StoryAnnotation, StoryDraft, StoryInput, StoryInterpreter, TranscriptInput } from "./types";

const int = z.coerce.number().int().catch(0);
const text = z.coerce.string().catch("");
const flag = z.coerce.boolean().catch(false);

const SegmentationResult = z.object({
  stories: z
    .array(
      z.object({
        first_segment: int,
        last_segment: int,
        title: text,
        quote_segment: int,
      }),
    )
    .catch([]),
});

const AnnotationResult = z.object({
  people: z.array(z.object({ segment: int, mention: text, name: text, relation: text, explicit: flag })).catch([]),
  places: z.array(z.object({ segment: int, mention: text, name: text, explicit: flag })).catch([]),
  times: z
    .array(
      z.object({
        segment: int,
        mention: text,
        explicit: flag,
        year_from: int,
        year_to: int,
        label: text,
        reason: text,
      }),
    )
    .catch([]),
  life_stage: z
    .object({ segment: int, mention: text, value: z.enum([...LIFE_STAGES, "unknown"]).catch("unknown"), explicit: flag })
    .nullable()
    .catch(null),
  themes: z.array(z.enum(THEMES).or(z.string())).catch([]),
  questions: z.array(text).catch([]),
});

const WINDOW_TOKENS = 7000;

function contextFor(promptTokens: number, outputTokens: number): number {
  const needed = promptTokens + outputTokens + 512;
  return Math.min(32768, Math.max(4096, Math.ceil(needed / 2048) * 2048));
}

export type InterpreterLog = { step: string; stats: ChatStats };

export class GemmaInterpreter implements StoryInterpreter {
  readonly log: InterpreterLog[] = [];

  constructor(readonly model: string = config.interpreterModel) {}

  private async segmentWindow(input: TranscriptInput, segments: Segment[]): Promise<StoryDraft[]> {
    const language = languageName(input.language);
    const system = segmentationSystem(input.narrator, language);
    const user = segmentationUser(input, language, segments);
    const { data, stats } = await chatJson({
      model: this.model,
      system,
      user,
      schema: segmentationSchema,
      numCtx: contextFor(estimateTokens(system + user), 2048),
    });
    this.log.push({ step: `segment ${segments[0]?.idx}-${segments.at(-1)?.idx}`, stats });
    const parsed = SegmentationResult.parse(data);
    return parsed.stories.map((s) => ({
      firstSegment: s.first_segment,
      lastSegment: s.last_segment,
      title: s.title,
      quoteSegment: s.quote_segment,
    }));
  }

  async findStories(input: TranscriptInput): Promise<StoryDraft[]> {
    const all = input.segments;
    if (!all.length) return [];
    const drafts: StoryDraft[] = [];
    let start = 0;
    while (start < all.length) {
      let budget = 0;
      let end = start;
      while (end < all.length && budget + estimateTokens(all[end].text) + 6 < WINDOW_TOKENS) {
        budget += estimateTokens(all[end].text) + 6;
        end++;
      }
      if (end === start) end = start + 1;
      const window = all.slice(start, end);
      const found = (await this.segmentWindow(input, window)).filter(
        (d) => d.lastSegment >= window[0].idx && d.firstSegment <= window[window.length - 1].idx,
      );
      const more = end < all.length;
      if (more && found.length > 1) {
        const last = found.pop()!;
        drafts.push(...found);
        const nextStart = all.findIndex((s) => s.idx >= last.firstSegment);
        start = nextStart > start ? nextStart : end;
      } else {
        drafts.push(...found);
        start = end;
      }
    }
    return drafts;
  }

  async annotateStory(input: StoryInput): Promise<StoryAnnotation> {
    const language = languageName(input.language);
    const system = annotationSystem(input.narrator, language, input.birthYear);
    const user = annotationUser(input, language);
    const { data, stats } = await chatJson({
      model: this.model,
      system,
      user,
      schema: annotationSchema,
      numCtx: contextFor(estimateTokens(system + user), 1536),
    });
    this.log.push({ step: `annotate "${input.title}"`, stats });
    const parsed = AnnotationResult.parse(data);
    const themes = parsed.themes.filter((t): t is (typeof THEMES)[number] => (THEMES as readonly string[]).includes(t));
    const stage = parsed.life_stage;
    return {
      people: parsed.people.map((p) => ({ ...p })),
      places: parsed.places.map((p) => ({ ...p })),
      times: parsed.times.map((t) => ({
        label: t.label,
        yearFrom: t.year_from > 0 ? t.year_from : null,
        yearTo: t.year_to > 0 ? t.year_to : t.year_from > 0 ? t.year_from : null,
        mention: t.mention,
        segment: t.segment,
        explicit: t.explicit,
        reason: t.reason,
      })),
      lifeStage:
        stage && stage.value !== "unknown"
          ? { value: stage.value, mention: stage.mention, segment: stage.segment, explicit: stage.explicit }
          : null,
      themes: [...new Set(themes)].slice(0, 3),
      questions: parsed.questions.map((q) => q.trim()).filter(Boolean).slice(0, 2),
    };
  }
}

export function createInterpreter(): StoryInterpreter {
  return new GemmaInterpreter();
}
