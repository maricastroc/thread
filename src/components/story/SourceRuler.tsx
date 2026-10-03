import Link from "next/link";
import { formatClock } from "@/lib/format";
import { t } from "@/lib/i18n";

type Span = { id: string; start: number; end: number };

export function SourceRuler({ recordingId, date, duration, story, siblings }: { recordingId: string; date: string; duration: number; story: Span; siblings: Span[] }) {
  if (duration <= 0) return null;
  const at = (seconds: number) => `${Math.min(100, Math.max(0, (seconds / duration) * 100))}%`;
  const from = formatClock(story.start);
  const to = formatClock(story.end);
  const total = formatClock(duration);
  return (
    <Link href={`/recordings/${recordingId}`} aria-label={t.story.whereLabel(date, from, to, total)} className="group mt-4 flex max-w-[34rem] items-center gap-4">
      <span aria-hidden="true" className="relative block h-2 flex-1">
        <span className="absolute inset-x-0 top-[3.5px] h-px bg-rule-2" />
        {siblings
          .filter((s) => s.id !== story.id)
          .map((s) => (
            <span key={s.id} className="absolute top-[2.5px] h-[3px] rounded-full bg-rule-2" style={{ left: at(s.start), width: `calc(${at(s.end - s.start)} - 2px)` }} />
          ))}
        <span className="absolute top-0 h-2 min-w-1 rounded-full bg-ink transition-colors" style={{ left: at(story.start), width: at(story.end - story.start) }} />
      </span>
      <span aria-hidden="true" className="t-time shrink-0 text-ink-2 transition-colors group-hover:text-ink">
        {t.story.whereInRecording(from, to, total)}
      </span>
    </Link>
  );
}
