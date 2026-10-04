import assert from "node:assert/strict";
import { test } from "node:test";
import type { StoryAnnotation } from "../src/lib/server/interpreter/types";
import { verify, type VerifiedFact } from "../src/lib/server/provenance";
import type { LifeStage } from "../src/lib/types";

type Proposal = { value: LifeStage; mention: string; explicit: boolean } | null;

function story(text: string, proposal: Proposal = null) {
  const annotation: StoryAnnotation = {
    people: [],
    places: [],
    times: [],
    lifeStage: proposal ? { ...proposal, segment: 0 } : null,
    themes: [],
    questions: [],
  };
  return verify(annotation, [{ idx: 0, start: 0, end: 4, text, words: null, confidence: null }], { from: 0, to: 0 }, "Rosa", 1948);
}

const stageOf = (facts: VerifiedFact[]) => facts.find((f) => f.kind === "life_stage") ?? null;

test("an age the narrator says is explicit evidence of a stage of life, in each language", () => {
  for (const [text, value, evidence] of [
    ["Eu tinha 8 anos quando a gente se mudou.", "childhood", "Eu tinha 8 anos"],
    ["Aos 30 anos, eu fui morar sozinha.", "adulthood", "Aos 30 anos, eu"],
    ["I was fifteen when the war ended.", "youth", "I was fifteen"],
    ["Yo tenía 70 años cuando volví al pueblo.", "later_life", "Yo tenía 70 años"],
  ] as const) {
    const stage = stageOf(story(text).facts);
    assert.equal(stage?.value, value, text);
    assert.equal(stage?.provenance, "extracted", text);
    assert.equal(stage?.evidence, evidence, text);
  }
});

test("a stage of life the narrator names in their own words is explicit evidence, someone else's is not", () => {
  for (const [text, value] of [
    ["Quando eu era criança, a gente morava perto do rio.", "childhood"],
    ["Na minha adolescência eu trabalhava na roça.", "youth"],
    ["Quando já era adulta, eu aprendi a dirigir.", "adulthood"],
    ["As a child, I spent the summers on the farm.", "childhood"],
    ["Cuando yo era niña vivíamos en Málaga.", "childhood"],
    ["En mi juventud trabajé en un taller.", "youth"],
  ] as const) {
    const stage = stageOf(story(text).facts);
    assert.equal(stage?.value, value, text);
    assert.equal(stage?.provenance, "extracted", text);
  }
  for (const text of ["Quando a minha mãe era criança, ela morava no sítio.", "My mother was a child when the war started.", "Mi madre era una niña cuando llegó."]) {
    assert.equal(stageOf(story(text).facts), null, text);
  }
});

test("an activity that suggests a stage without naming it is kept only as an inference, citing its words", () => {
  for (const [text, mention] of [
    ["Eu comecei a trabalhar na fábrica de tecidos.", "comecei a trabalhar"],
    ["Tive meu primeiro filho no hospital da cidade.", "Tive meu primeiro filho"],
    ["I started working at the mill.", "started working at the mill"],
    ["Me casé en la iglesia del pueblo.", "Me casé"],
  ] as const) {
    const { facts, rejected } = story(text, { value: "adulthood", mention, explicit: true });
    const stage = stageOf(facts);
    assert.equal(stage?.value, "adulthood", text);
    assert.equal(stage?.provenance, "inferred", text);
    assert.equal(stage?.evidence, mention, text);
    assert.match(stage?.note ?? "", /don't name a stage of life/, text);
    assert.deepEqual(rejected, [], text);
  }
});

test("a proposed stage with no words behind it is refused, not kept", () => {
  for (const proposal of [
    { value: "youth" as const, mention: "", explicit: false },
    { value: "childhood" as const, mention: "quando eu era menina", explicit: true },
  ]) {
    const { facts, rejected } = story("A gente vendia o queijo na feira de sábado.", proposal);
    assert.equal(stageOf(facts), null);
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0].kind, "life_stage");
    assert.equal(rejected[0].reason, "No words in this story support this stage of life.");
  }
});

test("a proposal citing real words that don't say it is never taken as stated", () => {
  for (const [text, proposed, mention, value] of [
    ["Quando já era adulta, eu aprendi a dirigir.", "childhood", "Quando já era adulta", "adulthood"],
    ["I was fifteen when the war ended.", "later_life", "I was fifteen", "youth"],
    ["Yo tenía 70 años cuando volví al pueblo.", "youth", "Yo tenía 70 años", "later_life"],
  ] as const) {
    const { facts, rejected } = story(text, { value: proposed, mention, explicit: true });
    assert.equal(stageOf(facts)?.value, value, text);
    assert.equal(stageOf(facts)?.provenance, "extracted", text);
    assert.equal(rejected[0]?.value, proposed, text);
    assert.match(rejected[0]?.reason ?? "", /another stage of life/, text);
  }

  const { facts } = story("Então, pra ajudar em casa, eu comecei a costurar pra fora.", { value: "later_life", mention: "eu comecei a costurar pra fora", explicit: true });
  assert.equal(stageOf(facts)?.provenance, "inferred");
  assert.notEqual(stageOf(facts)?.provenance, "extracted");
});
