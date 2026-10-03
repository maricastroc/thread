import type { Stage, WorkStage } from "@/lib/types";

export type Outcome =
  | { kind: "working"; stage: Stage }
  | { kind: "failed"; stage: WorkStage; transcript: boolean }
  | { kind: "stories"; count: number }
  | { kind: "no-stories" }
  | { kind: "no-speech" };

export function outcomeOf(input: { stage: Stage; failedStage: WorkStage | null; segments: number; stories: number }): Outcome {
  if (input.failedStage) return { kind: "failed", stage: input.failedStage, transcript: input.segments > 0 };
  if (input.stage !== "ready") return { kind: "working", stage: input.stage };
  if (input.stories > 0) return { kind: "stories", count: input.stories };
  return input.segments > 0 ? { kind: "no-stories" } : { kind: "no-speech" };
}
