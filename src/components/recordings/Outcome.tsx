import { t } from "@/lib/i18n";
import type { Outcome as OutcomeState } from "@/lib/sources";

export function outcomeText(outcome: OutcomeState): string {
  if (outcome.kind === "stories") return t.recordings.outcome.stories(outcome.count);
  if (outcome.kind === "no-stories") return t.recordings.outcome.noStories;
  if (outcome.kind === "no-speech") return t.recordings.outcome.noSpeech;
  if (outcome.kind === "working") return t.recordings.outcome.working;
  return t.recordings.outcome.failed;
}

export function OutcomeLabel({ outcome, className = "" }: { outcome: OutcomeState; className?: string }) {
  const mark =
    outcome.kind === "stories" ? (
      <span aria-hidden="true" className="size-2 rounded-full bg-ink" />
    ) : outcome.kind === "working" ? (
      <span aria-hidden="true" className="animate-breathe size-2 rounded-full bg-voice" />
    ) : outcome.kind === "failed" ? (
      <span aria-hidden="true" className="size-2 rounded-full border-[1.5px] border-voice" />
    ) : (
      <span aria-hidden="true" className="size-2 rounded-full border-[1.5px] border-ink-3" />
    );
  const tone = outcome.kind === "stories" ? "text-ink" : outcome.kind === "failed" ? "text-voice" : "text-ink-2";
  return (
    <span className={`inline-flex items-center gap-2 text-[0.9375rem] whitespace-nowrap ${tone} ${className}`}>
      {mark}
      {outcomeText(outcome)}
    </span>
  );
}
