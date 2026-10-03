import "server-only";
import type { FactKind, LifeStage, Provenance, Segment } from "@/lib/types";
import type { StoryAnnotation } from "./interpreter/types";
import { statesYear } from "./numbers";
import { containsPhrase, locateInSegment, normalize, tokens } from "./text";

export type VerifiedFact = {
  kind: FactKind;
  value: string;
  detail: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  provenance: Provenance;
  primary: boolean;
  seg: number | null;
  evidence: string | null;
  start: number | null;
  end: number | null;
  note: string | null;
  entity?: { name: string; relation: string | null; aliases: string[] };
};

type Evidence = { seg: number; start: number; end: number; evidence: string };

const leadingWords = new Set(["o", "a", "os", "as", "seu", "sr", "sra", "dona", "dom", "the", "el", "la", "meu", "minha"]);

export function properAlias(mention: string): string | null {
  const words = mention.trim().split(/\s+/);
  while (words.length > 1 && leadingWords.has(normalize(words[0]))) words.shift();
  const alias = words.join(" ").replace(/[.,;:!?]+$/g, "");
  return /^\p{Lu}/u.test(alias) && alias.length >= 2 ? alias : null;
}

function rangeOrder(segments: Segment[], from: number, to: number, claimed: number): Segment[] {
  const inRange = segments.filter((s) => s.idx >= from && s.idx <= to);
  return inRange.sort((a, b) => Math.abs(a.idx - claimed) - Math.abs(b.idx - claimed));
}

function findEvidence(segments: Segment[], from: number, to: number, claimed: number, phrases: string[]): Evidence | null {
  const order = rangeOrder(segments, from, to, claimed);
  for (const phrase of phrases) {
    if (!normalize(phrase)) continue;
    for (const segment of order) {
      const hit = locateInSegment(segment, phrase);
      if (hit) return { seg: segment.idx, ...hit };
    }
  }
  return null;
}

function evidencePhrases(name: string, mention: string, relation: string | null): string[] {
  const phrases = [name];
  if (tokens(mention).length <= 5) phrases.push(mention);
  const alias = properAlias(mention);
  if (alias) phrases.push(alias);
  if (relation?.trim()) phrases.push(relation.trim());
  phrases.push(mention);
  return phrases.filter((p, i, all) => normalize(p) && all.findIndex((q) => normalize(q) === normalize(p)) === i);
}

function calculatedNote(evidence: string, birthYear: number | null): string {
  return birthYear ? `Calculated from “${evidence}” and the year of birth, ${birthYear}.` : `Calculated from “${evidence}”.`;
}

function stageForAge(age: number): LifeStage {
  if (age <= 12) return "childhood";
  if (age <= 25) return "youth";
  if (age <= 59) return "adulthood";
  return "later_life";
}

function yearLabel(from: number | null, to: number | null, fallback: string): string {
  if (from && to && from !== to) {
    if (from % 10 === 0 && to === from + 9) return `${from}s`;
    return `${from}–${to}`;
  }
  if (from) return String(from);
  return fallback.trim();
}

function yearsInText(text: string, from: number | null, to: number | null): boolean {
  const years = [from, to].filter((y): y is number => !!y).map(String);
  return years.length > 0 && years.every((y) => text.includes(y));
}

export function verify(
  annotation: StoryAnnotation,
  segments: Segment[],
  range: { from: number; to: number },
  narrator: string,
  birthYear: number | null,
): VerifiedFact[] {
  const facts: VerifiedFact[] = [];
  const byIdx = new Map(segments.map((s) => [s.idx, s]));
  const narratorKey = normalize(narrator);
  const seenEntities = new Set<string>();

  const expand = (kind: "person" | "place", value: string, phrases: string[], primary: Evidence, base: Omit<VerifiedFact, "primary" | "seg" | "evidence" | "start" | "end" | "provenance">) => {
    for (const segment of segments) {
      if (segment.idx < range.from || segment.idx > range.to || segment.idx === primary.seg) continue;
      for (const phrase of phrases) {
        const hit = locateInSegment(segment, phrase);
        if (!hit) continue;
        facts.push({
          ...base,
          kind,
          provenance: containsPhrase(hit.evidence, value) ? "said" : "extracted",
          primary: false,
          seg: segment.idx,
          ...hit,
        });
        break;
      }
    }
  };

  for (const person of annotation.people) {
    const name = person.name.trim();
    const key = normalize(name);
    if (!key || key === narratorKey || narratorKey.split(" ").includes(key) || seenEntities.has(`person:${key}`)) continue;
    const evidence = findEvidence(segments, range.from, range.to, person.segment, evidencePhrases(name, person.mention, person.relation));
    if (!evidence) continue;
    seenEntities.add(`person:${key}`);
    const literal = containsPhrase(byIdx.get(evidence.seg)?.text ?? "", name);
    const provenance: Provenance = literal ? "said" : person.explicit ? "extracted" : "inferred";
    const alias = properAlias(person.mention);
    const aliases = alias && normalize(alias) !== key ? [alias] : [];
    const relation = person.relation.trim() || null;
    const base = {
      kind: "person" as const,
      value: name,
      detail: relation,
      yearFrom: null,
      yearTo: null,
      note: null,
      entity: { name, relation, aliases },
    };
    facts.push({ ...base, provenance, primary: true, ...evidence });
    const phrases = [name, ...aliases, ...(tokens(person.mention).length <= 4 ? [person.mention] : [])].filter(
      (p, i, all) => normalize(p) && all.findIndex((q) => normalize(q) === normalize(p)) === i,
    );
    expand("person", name, phrases, evidence, base);
  }

  for (const place of annotation.places) {
    const name = place.name.trim();
    const key = normalize(name);
    if (!key || seenEntities.has(`place:${key}`)) continue;
    const evidence = findEvidence(segments, range.from, range.to, place.segment, evidencePhrases(name, place.mention, null));
    if (!evidence) continue;
    seenEntities.add(`place:${key}`);
    const literal = containsPhrase(byIdx.get(evidence.seg)?.text ?? "", name);
    const provenance: Provenance = literal ? "said" : place.explicit ? "extracted" : "inferred";
    const alias = properAlias(place.mention);
    const aliases = alias && normalize(alias) !== key ? [alias] : [];
    const base = {
      kind: "place" as const,
      value: name,
      detail: null,
      yearFrom: null,
      yearTo: null,
      note: null,
      entity: { name, relation: null, aliases },
    };
    facts.push({ ...base, provenance, primary: true, ...evidence });
    const phrases = [name, ...aliases].filter((p, i, all) => all.findIndex((q) => normalize(q) === normalize(p)) === i);
    expand("place", name, phrases, evidence, base);
  }

  const currentYear = new Date().getFullYear();
  const seenTimes = new Set<string>();
  for (const time of annotation.times) {
    const validFrom = time.yearFrom && time.yearFrom >= 1800 && time.yearFrom <= currentYear ? time.yearFrom : null;
    const validTo = time.yearTo && time.yearTo >= (validFrom ?? 1800) && time.yearTo <= currentYear ? time.yearTo : validFrom;
    if (!validFrom) continue;
    const value = yearLabel(validFrom, validTo, time.label);
    if (!value || seenTimes.has(value)) continue;
    const evidence = time.mention.trim() ? findEvidence(segments, range.from, range.to, time.segment, [time.mention]) : null;
    let provenance: Provenance;
    let note: string | null = null;
    if (evidence) {
      const text = byIdx.get(evidence.seg)?.text ?? "";
      const stated = time.explicit && (statesYear(evidence.evidence, validFrom) || statesYear(text, validFrom));
      provenance = !stated ? "inferred" : yearsInText(text, validFrom, validTo) ? "said" : "extracted";
      if (provenance === "inferred") {
        note = time.explicit || !time.reason.trim() ? calculatedNote(evidence.evidence, birthYear) : time.reason.trim();
      }
    } else if (!time.explicit && time.reason.trim()) {
      provenance = "inferred";
      note = time.reason.trim();
    } else {
      continue;
    }
    seenTimes.add(value);
    facts.push({
      kind: "time",
      value,
      detail: null,
      yearFrom: validFrom,
      yearTo: validTo,
      provenance,
      primary: true,
      seg: evidence?.seg ?? null,
      evidence: evidence?.evidence ?? null,
      start: evidence?.start ?? null,
      end: evidence?.end ?? null,
      note,
    });
  }

  const anchor = facts.find((f) => f.kind === "time" && f.provenance !== "inferred" && f.yearFrom);
  if (anchor && birthYear && anchor.yearFrom! >= birthYear) {
    const age = anchor.yearFrom! - birthYear;
    facts.push({
      kind: "life_stage",
      value: stageForAge(age),
      detail: null,
      yearFrom: null,
      yearTo: null,
      provenance: "inferred",
      primary: true,
      seg: null,
      evidence: null,
      start: null,
      end: null,
      note: `About ${age} years old in ${anchor.yearFrom}, counted from the year of birth.`,
    });
    return facts;
  }

  const stage = annotation.lifeStage;
  if (stage) {
    const evidence =
      stage.explicit && stage.mention.trim() ? findEvidence(segments, range.from, range.to, stage.segment, [stage.mention]) : null;
    facts.push({
      kind: "life_stage",
      value: stage.value satisfies LifeStage,
      detail: null,
      yearFrom: null,
      yearTo: null,
      provenance: evidence ? "extracted" : "inferred",
      primary: true,
      seg: evidence?.seg ?? null,
      evidence: evidence?.evidence ?? null,
      start: evidence?.start ?? null,
      end: evidence?.end ?? null,
      note: null,
    });
  }

  return facts;
}
