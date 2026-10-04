import assert from "node:assert/strict";
import { test } from "node:test";
import type { StoryAnnotation } from "../src/lib/server/interpreter/types";
import { verify, type Known, type VerifiedFact } from "../src/lib/server/provenance";
import type { Segment } from "../src/lib/types";

const lines = [
  "Eu nasci em Olinda, em 1939, perto do rio Beberibe.",
  "A minha irmã Bia era a mais velha.",
  "A mãe do Zé ficava na margem, gritando.",
  "A minha mãe era costureira.",
  "Cinco anos mais tarde a gente casou numa igreja pequena, perto do rio.",
  "Por volta de 1950, a professora me deu um livro.",
];
const segments: Segment[] = lines.map((text, idx) => ({ idx, start: idx * 5, end: idx * 5 + 4, text, words: null, confidence: null }));
const range = { from: 0, to: lines.length - 1 };

const annotation = (patch: Partial<StoryAnnotation>): StoryAnnotation => ({
  people: [],
  places: [],
  times: [],
  lifeStage: null,
  themes: [],
  questions: [],
  ...patch,
});

test("a kinship word names the narrator's relative only with 'my'", () => {
  const { facts, rejected } = verify(
    annotation({
      people: [
        { name: "Mãe", relation: "mãe", mention: "A minha mãe", segment: 3, explicit: true },
        { name: "Bia", relation: "irmã", mention: "minha irmã Bia", segment: 1, explicit: true },
      ],
    }),
    segments,
    range,
    "Armando",
    1939,
  );
  const mother = facts.filter((f) => f.kind === "person" && f.value === "Mãe");
  assert.ok(mother.length >= 1);
  assert.ok(mother.every((f) => f.seg !== 2), "the narrator's mother is never anchored on 'a mãe do Zé'");
  assert.equal(facts.find((f) => f.value === "Bia")?.detail, "irmã");
  assert.equal(rejected.length, 0);
});

test("generic places never become shared places", () => {
  const story = { from: 1, to: lines.length - 1 };
  const { facts, rejected } = verify(
    annotation({
      places: [
        { name: "igreja pequena", mention: "igreja pequena", segment: 4, explicit: true },
        { name: "rio Beberibe", mention: "rio", segment: 4, explicit: false },
      ],
    }),
    segments,
    story,
    "Armando",
    1939,
  );
  assert.deepEqual(facts.filter((f) => f.kind === "place"), []);
  assert.match(rejected[0].reason, /common noun/);
  assert.match(rejected[1].reason, /would be a guess/);
});

test("years need words that support them", () => {
  const { facts, rejected } = verify(
    annotation({
      times: [
        { label: "1964", yearFrom: 1964, yearTo: 1964, mention: "Cinco anos mais tarde", segment: 4, explicit: false, reason: "Five years after 1959." },
        { label: "1950", yearFrom: 1950, yearTo: 1950, mention: "Por volta de 1950", segment: 5, explicit: true, reason: "" },
      ],
    }),
    segments,
    range,
    "Armando",
    1939,
  );
  const time = facts.find((f) => f.kind === "time");
  assert.equal(time?.value, "c. 1950");
  assert.equal(time?.yearFrom, 1948);
  assert.equal(time?.yearTo, 1952);
  assert.equal(rejected.filter((r) => r.kind === "time").length, 1);
  assert.ok(!facts.some((f) => f.note?.includes("Five years after")), "the model's reasoning is never shown");
});

test("a name built as an institution's is not kept as a person, while people named after places stay people", () => {
  const said = [
    "Eu costurei quarenta fardas pro Colégio das Freiras.",
    "O meu pai trabalhou no Banco do Brasil.",
    "La Escuela Normal quedaba lejos del pueblo.",
    "My brother worked at the Bank of England.",
    "O Zé da Padaria me vendia pão fiado.",
    "A dona Maria Igreja era a parteira.",
    "O Capela jogava bola com a gente.",
  ];
  const lines: Segment[] = said.map((text, idx) => ({ idx, start: idx * 5, end: idx * 5 + 4, text, words: null, confidence: null }));
  const names = ["Colégio das Freiras", "Banco do Brasil", "Escuela Normal", "Bank of England", "Zé da Padaria", "Maria Igreja", "Capela"];
  const { facts, rejected } = verify(
    annotation({ people: names.map((name, segment) => ({ name, relation: "", mention: name, segment, explicit: true })) }),
    lines,
    { from: 0, to: lines.length - 1 },
    "Armando",
    1939,
  );
  assert.deepEqual(
    facts.filter((f) => f.kind === "person" && f.primary).map((f) => f.value),
    ["Zé da Padaria", "Maria Igreja", "Capela"],
  );
  assert.deepEqual(
    rejected.map((r) => r.value),
    ["Colégio das Freiras", "Banco do Brasil", "Escuela Normal", "Bank of England"],
  );
  assert.ok(rejected.every((r) => r.kind === "person" && r.reason === "The name of an institution, not a person."));
});

const story = (said: string[], patch: Partial<StoryAnnotation>, known?: Known) => {
  const lines: Segment[] = said.map((text, idx) => ({ idx, start: idx * 5, end: idx * 5 + 4, text, words: null, confidence: null }));
  return verify(annotation(patch), lines, { from: 0, to: lines.length - 1 }, "Armando", 1939, known);
};
const place = (name: string, mention: string, segment: number) => ({ name, mention, segment, explicit: true });
const person = (name: string, mention: string, segment: number, relation = "") => ({ name, relation, mention, segment, explicit: true });
const named = (facts: VerifiedFact[]) => facts.filter((f) => f.primary && (f.kind === "person" || f.kind === "place")).map((f) => [f.value, f.provenance]);

test("a name said as one expression is said", () => {
  const { facts, rejected } = story(["Eu nasci em Olinda, perto do rio Beberibe.", "A Bia era a mais velha."], {
    places: [place("Olinda", "Olinda", 0), place("rio Beberibe", "rio Beberibe", 0)],
    people: [person("Bia", "A Bia", 1)],
  });
  assert.deepEqual(named(facts), [
    ["Bia", "said"],
    ["Olinda", "said"],
    ["rio Beberibe", "said"],
  ]);
  assert.deepEqual(rejected, []);
});

test("a real name written in lowercase counts only when it is written as a name elsewhere or the archive already knows it", () => {
  const lines = ["Depois a gente foi morar em vila velha, na beira do mar."];
  const proposal = { places: [place("Vila Velha", "vila velha", 0)] };
  const alone = story(lines, proposal);
  assert.deepEqual(named(alone.facts), []);
  assert.match(alone.rejected[0].reason, /common word/);
  assert.deepEqual(named(story(lines, proposal, { people: [], places: [{ name: "Vila Velha", relation: null, aliases: [] }] }).facts), [["Vila Velha", "said"]]);
  assert.deepEqual(named(story([...lines, "Ela sempre voltava pra Vila Velha."], proposal).facts), [["Vila Velha", "said"]]);
});

test("a common noun is not a name, even when the model capitalizes it or a sentence begins with it", () => {
  const { facts, rejected } = story(["O meu pai tinha uma bodega na esquina.", "Bodega era o lugar de todo mundo."], { places: [place("Bodega", "uma bodega", 0)] });
  assert.deepEqual(named(facts), []);
  assert.match(rejected[0].reason, /common word/);
});

test("a name made up from words said apart is never taken as said", () => {
  const { facts, rejected } = story(["O meu pai dava fiado pra todo mundo na bodega.", "A Maria chegou cedo, e o Silva veio depois."], {
    places: [place("Bodega do Pai", "na bodega", 0)],
    people: [person("Maria Silva", "A Maria", 1)],
  });
  assert.ok(!facts.some((f) => f.value === "Bodega do Pai" || f.value === "Maria Silva"));
  assert.match(rejected.find((r) => r.value === "Bodega do Pai")?.reason ?? "", /not together/);
  assert.deepEqual(named(facts), [["Maria", "said"]]);
  assert.match(rejected.find((r) => r.value === "Maria Silva")?.reason ?? "", /kept as “Maria”/);
});

test("someone the archive already knows can be mentioned again, in other words or by name", () => {
  const known = { people: [{ name: "Antônio", relation: "pai", aliases: [] }, { name: "José", relation: null, aliases: [] }], places: [] };
  const { facts, rejected } = story(
    ["O meu pai dava fiado pra todo mundo.", "O José voltou do Rio."],
    { people: [person("Antônio", "O meu pai", 0, "pai"), person("José", "O José", 1)] },
    known,
  );
  assert.deepEqual(
    facts.filter((f) => f.primary).map((f) => [f.value, f.provenance, f.evidence, f.detail]),
    [
      ["Antônio", "extracted", "O meu pai", "pai"],
      ["José", "said", "José", null],
    ],
  );
  assert.deepEqual(rejected, []);
});
