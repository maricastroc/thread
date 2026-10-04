import assert from "node:assert/strict";
import { test } from "node:test";
import type { StoryAnnotation } from "../src/lib/server/interpreter/types";
import { verify } from "../src/lib/server/provenance";
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
