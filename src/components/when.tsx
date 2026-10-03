import type { Provenance, When } from "@/lib/types";
import { t } from "@/lib/i18n";

export function whenText(when: When | null): string | null {
  if (!when) return null;
  if (when.provenance !== "inferred") return when.label;
  return /^\d{4}$/.test(when.label) ? `[${t.time.circa(when.label)}]` : `[${when.label}]`;
}

export function ProvenanceNote({ provenance }: { provenance: Provenance }) {
  return <span className="visually-hidden">{`, ${t.provenance.long[provenance].toLowerCase()}`}</span>;
}

export function WhenLabel({ when, className }: { when: When | null; className?: string }) {
  const text = whenText(when);
  if (!when || !text) return null;
  return (
    <span className={className}>
      <span aria-hidden={when.provenance === "inferred" ? true : undefined}>{text}</span>
      {when.provenance === "inferred" && (
        <span className="visually-hidden">{`${when.label}, ${t.provenance.long.inferred.toLowerCase()}`}</span>
      )}
    </span>
  );
}

export function TimelineDot({ when }: { when: When | null }) {
  if (!when) return <span className="block size-[9px]" aria-hidden="true" />;
  const inferred = when.provenance === "inferred";
  return (
    <span
      aria-hidden="true"
      className={`block size-[9px] rounded-full border-[1.5px] ${inferred ? "border-ink-2 bg-paper" : "border-ink bg-ink"}`}
    />
  );
}
