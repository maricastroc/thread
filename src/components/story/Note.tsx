"use client";

import Link from "next/link";
import { formatClock } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { ViewNote } from "@/lib/story-view";
import type { LifeStage } from "@/lib/types";

export function noteTitle(note: ViewNote): string {
  if (note.kind === "life_stage") return t.lifeStage[note.value as LifeStage] ?? note.value;
  if (note.kind === "time" && note.provenance === "inferred" && /^\d{4}$/.test(note.value)) return t.time.circa(note.value);
  return note.value;
}

function kindLabel(note: ViewNote): string | null {
  if (note.kind === "person") return note.detail && note.detail.toLowerCase() !== note.value.toLowerCase() ? note.detail : null;
  if (note.kind === "place") return t.provenance.kinds.place;
  if (note.kind === "time") return t.provenance.kinds.time;
  return t.story.lifeStage.toLowerCase();
}

type Props = {
  note: ViewNote;
  language: string | null;
  lit?: boolean;
  highlighted?: boolean;
  onPlay?: (time: number) => void;
  onHover?: (id: number | null) => void;
  compact?: boolean;
  offset?: number;
};

export function Note({ note, language, lit, highlighted, onPlay, onHover, compact, offset = 0 }: Props) {
  const inferred = note.provenance === "inferred";
  const title = noteTitle(note);
  const kind = kindLabel(note);
  const contentLang = note.kind === "person" || note.kind === "place" ? language ?? undefined : undefined;

  return (
    <div
      onMouseEnter={() => onHover?.(note.id)}
      onMouseLeave={() => onHover?.(null)}
      className={`group/note relative transition-colors duration-300 ${compact ? "py-1" : "py-1.5 pl-4"} ${
        highlighted ? "text-ink" : ""
      }`}
    >
      {!compact && (
        <span
          aria-hidden="true"
          className={`absolute top-[0.6rem] left-0 size-[7px] rounded-full transition-colors duration-300 ${
            lit ? "bg-voice" : inferred ? "border border-ink-3 bg-transparent" : "bg-ink-3"
          }`}
        />
      )}
      <p className="text-[0.9375rem] leading-snug">
        {note.href ? (
          <Link href={note.href} lang={contentLang} className="link font-medium">
            {inferred ? `[${title}]` : title}
          </Link>
        ) : (
          <span lang={contentLang} className={inferred ? "italic" : "font-medium"}>
            {inferred ? `[${title}]` : title}
          </span>
        )}
        {kind && (
          <span className="text-ink-2" lang={note.kind === "person" ? language ?? undefined : undefined}>
            {" "}
            · {kind}
          </span>
        )}
      </p>
      <p className="t-small mt-0.5 text-ink-2">
        {note.provenance === "said" && t.provenance.said}
        {note.provenance === "extracted" && (
          <>
            {t.provenance.fromPrefix}
            <span lang={language ?? undefined}>“{note.evidence}”</span>
          </>
        )}
        {inferred && <span className="italic">{t.provenance.inferred}</span>}
        {note.start !== null && onPlay && (
          <>
            {" · "}
            <button
              type="button"
              onClick={() => onPlay(Math.max(0, note.start! - 0.6))}
              aria-label={t.story.playMoment(formatClock(note.start - offset))}
              className="t-time inline-flex min-h-6 items-center rounded-sm text-ink-2 underline decoration-rule-2 underline-offset-2 hover:text-ink hover:decoration-ink"
            >
              {formatClock(note.start - offset)}
            </button>
          </>
        )}
      </p>
      {inferred && note.note && <p className="t-small mt-1 max-w-[16rem] text-ink-2 italic">{note.note}</p>}
    </div>
  );
}
