import "server-only";
import type { Fact, LifeStage, Provenance, When } from "@/lib/types";
import { t } from "@/lib/i18n";

const rank: Record<Provenance, number> = { said: 0, extracted: 1, inferred: 2 };

const stageSpan: Record<LifeStage, [number, number]> = {
  childhood: [0, 12],
  youth: [13, 25],
  adulthood: [26, 59],
  later_life: [60, 95],
};

export function stageYears(stage: LifeStage, birthYear: number): [number, number] {
  const [a, b] = stageSpan[stage];
  return [birthYear + a, birthYear + b];
}

export function whenFromFacts(facts: Pick<Fact, "kind" | "value" | "yearFrom" | "yearTo" | "provenance">[], birthYear: number | null): When | null {
  const stageFact = facts.find((f) => f.kind === "life_stage");
  const lifeStage = (stageFact?.value as LifeStage | undefined) ?? null;
  const dated = facts
    .filter((f) => f.kind === "time" && f.yearFrom)
    .sort(
      (a, b) =>
        rank[a.provenance] - rank[b.provenance] ||
        (a.yearTo! - a.yearFrom!) - (b.yearTo! - b.yearFrom!) ||
        a.yearFrom! - b.yearFrom!,
    );
  const best = dated[0];
  if (best) {
    return { label: best.value, yearFrom: best.yearFrom, yearTo: best.yearTo, provenance: best.provenance, lifeStage };
  }
  if (lifeStage) {
    const label = t.lifeStage[lifeStage];
    if (birthYear && (lifeStage === "childhood" || lifeStage === "youth")) {
      const [from, to] = stageYears(lifeStage, birthYear);
      return { label, yearFrom: from, yearTo: to, provenance: "inferred", lifeStage };
    }
    return { label, yearFrom: null, yearTo: null, provenance: stageFact!.provenance, lifeStage };
  }
  return null;
}

export function sortYear(when: When | null): number | null {
  if (!when?.yearFrom) return null;
  const to = when.yearTo ?? when.yearFrom;
  return when.lifeStage && when.provenance === "inferred" && to - when.yearFrom > 3 ? when.yearFrom + (to - when.yearFrom) / 2 : when.yearFrom;
}
