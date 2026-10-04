import "server-only";
import type { FactKind, LifeStage, Provenance, Segment } from "@/lib/types";
import type { KnownEntity, StoryAnnotation } from "./interpreter/types";
import { findAges, findFirstPersonAge, isApproximate, statesYear } from "./numbers";
import { containsPhrase, locateInSegment, locateSaid, normalize, saidWords, saysPhrase, tokens } from "./text";
import { findNamedStages, hasProperWord, kinship, leadingWords, mentionsOwnKin, namesInstitution, ownedKin, properWords } from "./words";

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

export type Rejection = { kind: FactKind; value: string; mention: string | null; reason: string };

export type Verified = { facts: VerifiedFact[]; rejected: Rejection[] };

type Evidence = { seg: number; start: number; end: number; evidence: string };

export type Known = { people: KnownEntity[]; places: KnownEntity[] };

const linkingWords = new Set(["de", "da", "do", "das", "dos", "e", "del", "y", "of", "di", "du"]);

const nameWord = (word: string) => /^\p{Lu}/u.test(word) && !linkingWords.has(normalize(word)) && !leadingWords.has(normalize(word));

function isKnown(list: KnownEntity[], name: string): boolean {
  const key = normalize(name);
  return list.some((e) => normalize(e.name) === key || e.aliases.some((a) => normalize(a) === key));
}

function writtenAsName(segments: Segment[], phrase: string): boolean {
  return segments.some((segment) => (saidWords(segment.text, phrase) ?? []).some((w) => !w.opensSentence && nameWord(w.word)));
}

function madeUpFrom(text: string, name: string): boolean {
  const heard = new Set(tokens(text));
  const parts = tokens(name).filter((w) => !linkingWords.has(w) && !leadingWords.has(w));
  return parts.length > 1 && parts.every((w) => heard.has(w));
}

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

function findEvidence(segments: Segment[], from: number, to: number, claimed: number, phrases: string[], accept?: (segment: Segment) => boolean): Evidence | null {
  const order = rangeOrder(segments, from, to, claimed);
  for (const phrase of phrases) {
    if (!normalize(phrase)) continue;
    for (const segment of order) {
      if (accept && !accept(segment)) continue;
      const hit = locateInSegment(segment, phrase);
      if (hit) return { seg: segment.idx, ...hit };
    }
  }
  return null;
}

function bareKinship(name: string): boolean {
  const words = tokens(name).filter((w) => !leadingWords.has(w));
  return words.length === 1 && kinship.has(words[0]);
}

function isIndividual(name: string, mention: string): boolean {
  const words = (mention.trim() || name).split(/\s+/).filter((w) => !leadingWords.has(normalize(w)));
  if (words.some((w) => /^\p{Lu}/u.test(w))) return true;
  return normalize(`${name} ${mention}`)
    .split(" ")
    .some((w) => kinship.has(w));
}

function displayName(raw: string): string {
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length > 3 && name === name.toUpperCase() && /\p{Lu}/u.test(name)) {
    return name.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, space: string, letter: string) => space + letter.toUpperCase());
  }
  return name;
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

function ownsWord(segment: Segment, word: string): boolean {
  const key = tokens(word)[0];
  const words = tokens(segment.text);
  return words.some((w, i) => w === key && ownedKin(words, i));
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

type StatedStage = Evidence & { value: LifeStage; note: string | null };

function statedStages(inStory: Segment[]): StatedStage[] {
  const found: StatedStage[] = [];
  for (const segment of inStory) {
    const ages = findAges(segment.text)
      .filter((a) => a.firstPerson)
      .map((a) => ({ value: stageForAge(a.age), phrase: a.phrase, note: `Said as an age, ${a.age}.` }));
    const named = findNamedStages(segment.text).map((s) => ({ value: s.value, phrase: s.phrase, note: null }));
    for (const item of [...ages, ...named]) {
      const hit = locateInSegment(segment, item.phrase);
      found.push({ value: item.value, note: item.note, seg: segment.idx, start: hit?.start ?? segment.start, end: hit?.end ?? segment.end, evidence: hit?.evidence ?? item.phrase });
    }
  }
  return found.sort((a, b) => a.start - b.start);
}

export function statedPeriod(facts: VerifiedFact[]): VerifiedFact | null {
  return facts.find((f) => f.kind === "time" && f.yearFrom && f.provenance !== "inferred") ?? null;
}

const CARRIED = "Told right after";

export function carryPeriod(facts: VerifiedFact[], previous: VerifiedFact | null, birthYear: number | null): Verified {
  if (!previous?.yearFrom || facts.some((f) => f.kind === "time" && f.yearFrom)) return { facts, rejected: [] };
  if (previous.provenance === "inferred") {
    return {
      facts,
      rejected: [
        {
          kind: "time",
          value: previous.value,
          mention: null,
          reason: "The story told right before it is dated only by inference, and an inference is never the basis for another. No year is said in this story.",
        },
      ],
    };
  }
  const stage = facts.find((f) => f.kind === "life_stage");
  if (stage && stage.provenance !== "inferred") return { facts, rejected: [] };
  const year = previous.yearFrom;
  const result = facts.filter((f) => f.kind !== "life_stage");
  result.push({
    kind: "time",
    value: previous.value,
    detail: null,
    yearFrom: year,
    yearTo: previous.yearTo ?? year,
    provenance: "inferred",
    primary: true,
    seg: null,
    evidence: null,
    start: null,
    end: null,
    note: `${CARRIED} a story from ${previous.value}, in the same recording.`,
  });
  if (birthYear && year >= birthYear) {
    const age = year - birthYear;
    result.push({
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
      note: `About ${age} years old in ${year}, counted from the year of birth.`,
    });
  } else if (stage) {
    result.push(stage);
  }
  return { facts: result, rejected: [] };
}

export function periodCarrier(birthYear: number | null): (facts: VerifiedFact[]) => Verified {
  let previous: VerifiedFact | null = null;
  return (facts) => {
    const carried = carryPeriod(facts, previous, birthYear);
    previous = carried.facts.find((f) => f.kind === "time" && f.yearFrom) ?? null;
    return carried;
  };
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
  subject: string,
  birthYear: number | null,
  known: Known = { people: [], places: [] },
): Verified {
  const facts: VerifiedFact[] = [];
  const rejected: Rejection[] = [];
  const byIdx = new Map(segments.map((s) => [s.idx, s]));
  const subjectKey = normalize(subject);
  const seenEntities = new Set<string>();
  const inStory = segments.filter((s) => s.idx >= range.from && s.idx <= range.to);
  const storyText = inStory.map((s) => s.text).join(" ");
  const reject = (kind: FactKind, value: string, mention: string | null, reason: string) => rejected.push({ kind, value, mention: mention?.trim() || null, reason });

  const spoken = (phrase: string, claimed: number): Evidence | null => {
    for (const segment of rangeOrder(segments, range.from, range.to, claimed)) {
      const hit = locateSaid(segment, phrase);
      if (hit) return { seg: segment.idx, ...hit };
    }
    return null;
  };

  const spokenAlias = (mention: string, claimed: number): { name: string; evidence: Evidence } | null => {
    const alias = properAlias(mention);
    if (!alias || alias.includes(",") || tokens(alias).length > 3 || !writtenAsName(segments, alias)) return null;
    const evidence = spoken(alias, claimed);
    return evidence ? { name: alias, evidence } : null;
  };

  const unsaid = (name: string) =>
    madeUpFrom(storyText, name) ? "These words are in the story, but not together, so the name would be made up from them." : "Not found in the words of this story.";

  const expand = (
    kind: "person" | "place",
    value: string,
    phrases: string[],
    primary: Evidence,
    base: Omit<VerifiedFact, "primary" | "seg" | "evidence" | "start" | "end" | "provenance">,
    accept?: (segment: Segment) => boolean,
  ) => {
    for (const segment of inStory) {
      if (segment.idx === primary.seg || (accept && !accept(segment))) continue;
      for (const phrase of phrases) {
        const hit = locateSaid(segment, phrase);
        if (!hit) continue;
        const said = saysPhrase(hit.evidence, value);
        if (said && !accept && !hit.evidence.split(/\s+/).some(nameWord)) continue;
        facts.push({
          ...base,
          kind,
          provenance: said ? "said" : "extracted",
          primary: false,
          seg: segment.idx,
          ...hit,
        });
        break;
      }
    }
  };

  for (const person of annotation.people) {
    const raw = displayName(person.name);
    const name = bareKinship(raw) ? raw.charAt(0).toLocaleUpperCase() + raw.slice(1) : raw;
    const key = normalize(name);
    if (!key || key === subjectKey || subjectKey.split(" ").includes(key) || seenEntities.has(`person:${key}`)) continue;
    if (!isIndividual(name, person.mention || name)) {
      reject("person", name, person.mention, "A group or a common word, not one person.");
      continue;
    }
    if (namesInstitution(name)) {
      reject("person", name, person.mention, "The name of an institution, not a person.");
      continue;
    }
    const kin = bareKinship(name);
    if (kin && !mentionsOwnKin(storyText, name)) {
      const present = tokens(storyText).includes(tokens(name).filter((w) => !leadingWords.has(w))[0]);
      reject(
        "person",
        name,
        person.mention,
        present ? "A relative of someone else: the words never say “my”." : `The word “${name}” isn't in the words of this story, so the identity would be a translation or a guess.`,
      );
      continue;
    }
    const accept = kin ? (segment: Segment) => ownsWord(segment, name) : undefined;
    let named = name;
    let evidence: Evidence | null;
    let provenance: Provenance = "said";
    if (kin) {
      evidence = findEvidence(segments, range.from, range.to, person.segment, evidencePhrases(name, person.mention, person.relation), accept);
      if (evidence && !saysPhrase(byIdx.get(evidence.seg)?.text ?? "", name)) provenance = person.explicit ? "extracted" : "inferred";
    } else {
      evidence = spoken(name, person.segment);
      if (evidence && !isKnown(known.people, name) && !writtenAsName(segments, name)) {
        reject("person", name, person.mention, "Written here as a common word, so that it is someone's name would be a guess.");
        continue;
      }
      if (!evidence && isKnown(known.people, name)) {
        evidence = findEvidence(segments, range.from, range.to, person.segment, evidencePhrases(name, person.mention, person.relation));
        provenance = person.explicit ? "extracted" : "inferred";
      } else if (!evidence) {
        const alias = spokenAlias(person.mention, person.segment);
        if (alias && !seenEntities.has(`person:${normalize(alias.name)}`)) {
          reject("person", name, person.mention, `Not said as one expression; kept as “${alias.name}”, the words actually said.`);
          named = alias.name;
          evidence = alias.evidence;
        }
      }
    }
    if (!evidence) {
      reject("person", name, person.mention, kin ? "Not found in the words of this story." : unsaid(name));
      continue;
    }
    const namedKey = normalize(named);
    seenEntities.add(`person:${namedKey}`);
    const alias = properAlias(person.mention);
    const aliases = alias && normalize(alias) !== namedKey ? [alias] : [];
    const said = person.relation.trim();
    let relation: string | null = said && containsPhrase(storyText, said) ? said : null;
    if (relation && bareKinship(relation) && !mentionsOwnKin(storyText, relation)) {
      reject("person", `${named} (${relation})`, person.mention, "The relation is someone else's: the words never say “my”.");
      relation = null;
    }
    const base = {
      kind: "person" as const,
      value: named,
      detail: relation,
      yearFrom: null,
      yearTo: null,
      note: null,
      entity: { name: named, relation, aliases },
    };
    facts.push({ ...base, provenance, primary: true, ...evidence });
    const phrases = [named, ...aliases, ...(!kin && tokens(person.mention).length <= 4 ? [person.mention] : [])].filter(
      (p, i, all) => normalize(p) && all.findIndex((q) => normalize(q) === normalize(p)) === i,
    );
    expand("person", named, phrases, evidence, base, accept);
  }

  for (const place of annotation.places) {
    const name = displayName(place.name);
    const key = normalize(name);
    if (!key || seenEntities.has(`place:${key}`)) continue;
    if (!hasProperWord(name)) {
      reject("place", name, place.mention, "A common noun, not the name of a place, so it can't be the same place in another story.");
      continue;
    }
    let named = name;
    let provenance: Provenance = "said";
    let evidence = spoken(name, place.segment);
    if (evidence && !isKnown(known.places, name) && !writtenAsName(segments, name)) {
      reject("place", name, place.mention, "Written here as a common word, so that it is the name of a place would be a guess.");
      continue;
    }
    if (!evidence) {
      const found = findEvidence(segments, range.from, range.to, place.segment, evidencePhrases(name, place.mention, null));
      const proper = properWords(name);
      if (found && proper.length && !proper.some((w) => tokens(found.evidence).includes(w))) {
        reject("place", name, found.evidence, `The words only say “${found.evidence}”; that it is ${name} would be a guess.`);
        continue;
      }
      if (found && isKnown(known.places, name)) {
        evidence = found;
        provenance = place.explicit ? "extracted" : "inferred";
      } else {
        const alias = spokenAlias(place.mention, place.segment);
        if (alias && !seenEntities.has(`place:${normalize(alias.name)}`)) {
          reject("place", name, place.mention, `Not said as one expression; kept as “${alias.name}”, the words actually said.`);
          named = alias.name;
          evidence = alias.evidence;
        }
      }
    }
    if (!evidence) {
      reject("place", name, place.mention, unsaid(name));
      continue;
    }
    const namedKey = normalize(named);
    seenEntities.add(`place:${namedKey}`);
    const alias = properAlias(place.mention);
    const aliases = alias && normalize(alias) !== namedKey ? [alias] : [];
    const base = {
      kind: "place" as const,
      value: named,
      detail: null,
      yearFrom: null,
      yearTo: null,
      note: null,
      entity: { name: named, relation: null, aliases },
    };
    facts.push({ ...base, provenance, primary: true, ...evidence });
    const phrases = [named, ...aliases].filter((p, i, all) => all.findIndex((q) => normalize(q) === normalize(p)) === i);
    expand("place", named, phrases, evidence, base);
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
    if (!evidence) {
      reject("time", value, time.mention, "No words in this story support this year.");
      continue;
    }
    const text = byIdx.get(evidence.seg)?.text ?? "";
    const stated = statesYear(evidence.evidence, validFrom) || statesYear(text, validFrom);
    let provenance: Provenance;
    let note: string | null = null;
    let yearFrom = validFrom;
    let yearTo = validTo;
    let label = value;
    if (stated) {
      provenance = yearsInText(text, validFrom, validTo) ? "said" : "extracted";
      if (validFrom === validTo && isApproximate(text, validFrom)) {
        yearFrom = validFrom - 2;
        yearTo = validFrom + 2;
        label = `c. ${validFrom}`;
        note = `Said as an approximate year, around ${validFrom}.`;
      }
    } else {
      const age = birthYear ? findFirstPersonAge(text) : null;
      if (!age || Math.abs(birthYear! + age.age - validFrom) > 1) {
        reject("time", value, evidence.evidence, "The year isn't said, and no first-person age in these words gives it.");
        continue;
      }
      provenance = "inferred";
      note = calculatedNote(age.phrase, birthYear);
    }
    seenTimes.add(value);
    facts.push({
      kind: "time",
      value: label,
      detail: null,
      yearFrom,
      yearTo,
      provenance,
      primary: true,
      seg: evidence.seg,
      evidence: evidence.evidence,
      start: evidence.start,
      end: evidence.end,
      note,
    });
  }

  if (birthYear && !facts.some((f) => f.kind === "time" && f.yearFrom)) {
    for (const segment of inStory) {
      const found = findFirstPersonAge(segment.text);
      if (!found) continue;
      const year = birthYear + found.age;
      if (year > currentYear) break;
      const located = locateInSegment(segment, found.phrase);
      facts.push({
        kind: "time",
        value: String(year),
        detail: null,
        yearFrom: year,
        yearTo: year,
        provenance: "inferred",
        primary: true,
        seg: segment.idx,
        evidence: located?.evidence ?? found.phrase,
        start: located?.start ?? segment.start,
        end: located?.end ?? segment.end,
        note: calculatedNote(located?.evidence ?? found.phrase, birthYear),
      });
      break;
    }
  }

  const proposed = annotation.lifeStage;
  const stated = statedStages(inStory);
  if (stated.length) {
    const chosen = stated.find((s) => s.value === proposed?.value) ?? stated[0];
    facts.push({
      kind: "life_stage",
      value: chosen.value,
      detail: null,
      yearFrom: null,
      yearTo: null,
      provenance: "extracted",
      primary: true,
      seg: chosen.seg,
      evidence: chosen.evidence,
      start: chosen.start,
      end: chosen.end,
      note: chosen.note,
    });
    if (proposed && proposed.value !== chosen.value) {
      reject("life_stage", proposed.value, proposed.mention, `The words say “${chosen.evidence}”, which is another stage of life.`);
    }
    return { facts, rejected };
  }

  const anchor = statedPeriod(facts);
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
    return { facts, rejected };
  }

  if (proposed) {
    const evidence = proposed.mention.trim() ? findEvidence(segments, range.from, range.to, proposed.segment, [proposed.mention]) : null;
    if (evidence) {
      facts.push({
        kind: "life_stage",
        value: proposed.value satisfies LifeStage,
        detail: null,
        yearFrom: null,
        yearTo: null,
        provenance: "inferred",
        primary: true,
        ...evidence,
        note: "Inferred from these words, which don't name a stage of life.",
      });
    } else {
      reject("life_stage", proposed.value, proposed.mention, "No words in this story support this stage of life.");
    }
  }

  return { facts, rejected };
}

