import type { FactKind, Provenance } from "@/lib/types";

export type ViewWord = { t: number; e: number; x: string; m?: number[]; u?: boolean };

export type ViewNote = {
  id: number;
  kind: FactKind;
  value: string;
  detail: string | null;
  provenance: Provenance;
  evidence: string | null;
  start: number | null;
  note: string | null;
  href: string | null;
};

export type ViewParagraph = {
  start: number;
  end: number;
  words: ViewWord[];
  notes: ViewNote[];
};
