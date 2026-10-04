import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { periodCarrier, verify, type VerifiedFact } from "../src/lib/server/provenance";
import type { Segment } from "../src/lib/types";

const dir = mkdtempSync(path.join(tmpdir(), "thread-periods-"));
process.env.COFRE_DATA_DIR = dir;
after(() => rmSync(dir, { recursive: true, force: true }));

const said = (year: number, seg = 0, evidence = String(year)): VerifiedFact => ({
  kind: "time",
  value: String(year),
  detail: null,
  yearFrom: year,
  yearTo: year,
  provenance: "said",
  primary: true,
  seg,
  evidence,
  start: seg * 5,
  end: seg * 5 + 1,
  note: null,
});

const calculated = (year: number, phrase: string): VerifiedFact => ({
  ...said(year, 0, phrase),
  provenance: "inferred",
  note: `Calculated from “${phrase}” and the year of birth, 1948.`,
});

const yearOf = (facts: VerifiedFact[]) => facts.find((f) => f.kind === "time" && f.yearFrom) ?? null;

test("a year the words say is carried once, to the story told right after it, as an inference that says why", () => {
  const carry = periodCarrier(1948);
  carry([said(1978)]);
  const next = carry([]);
  const year = yearOf(next.facts);
  assert.equal(year?.yearFrom, 1978);
  assert.equal(year?.provenance, "inferred");
  assert.equal(year?.seg, null);
  assert.equal(year?.note, "Told right after a story from 1978, in the same recording.");
  assert.equal(next.facts.find((f) => f.kind === "life_stage")?.value, "adulthood");
  assert.deepEqual(next.rejected, []);
});

test("an inferred year is never the basis for another: the next story stays undated and the refusal is kept", () => {
  const carry = periodCarrier(1948);
  carry([said(1978)]);
  carry([]);
  const third = carry([]);
  assert.equal(yearOf(third.facts), null);
  assert.equal(third.rejected.length, 1);
  assert.equal(third.rejected[0].kind, "time");
  assert.equal(third.rejected[0].value, "1978");
  assert.match(third.rejected[0].reason, /only by inference/);

  const fromAge = periodCarrier(1948);
  fromAge([calculated(1956, "eu devia ter uns oito anos")]);
  const afterAge = fromAge([]);
  assert.equal(yearOf(afterAge.facts), null);
  assert.match(afterAge.rejected[0].reason, /only by inference/);
});

test("a year said again starts a new chain", () => {
  const carry = periodCarrier(1948);
  const years = [[said(1958)], [], [], [said(1965)], []].map((facts) => yearOf(carry(facts).facts));
  assert.deepEqual(
    years.map((y) => y?.yearFrom ?? null),
    [1958, 1958, null, 1965, 1965],
  );
  assert.deepEqual(
    years.map((y) => y?.provenance ?? null),
    ["said", "inferred", null, "said", "inferred"],
  );
});

test("an explicit relation such as 'dois anos depois' resolves against a year its own story says, never against a carried year", async () => {
  const { db } = await import("../src/lib/server/db");
  const { saveVault } = await import("../src/lib/server/archive");
  const { createRecording, replaceSegments, updateRecording } = await import("../src/lib/server/evidence");
  const { insertStory, saveAnnotation } = await import("../src/lib/server/interpretation");
  const { rederiveArchive } = await import("../src/lib/server/derive");

  saveVault({ subject: "Rosa", birthYear: 1940, language: "pt" });
  const lines = ["Em 1958 eu fui morar em Lisboa.", "Dois anos depois eu casei.", "A gente morava num quarto alugado.", "Três anos depois nasceu a nossa filha."];
  createRecording({ id: "rec", source: "imported", recordedAt: "2026-08-02T10:00:00Z", originalFile: "original.m4a", originalName: "rec.m4a", mime: "audio/mp4", prompt: null });
  replaceSegments("rec", lines.map((text, idx) => ({ idx, start: idx * 5, end: idx * 5 + 4, text, words: null, confidence: null })));
  updateRecording("rec", { stage: "ready", duration: lines.length * 5 });

  const carry = periodCarrier(1940);
  const stories = [
    { segStart: 0, segEnd: 1, dated: carry([said(1958, 0, "Em 1958")]) },
    { segStart: 2, segEnd: 3, dated: carry([]) },
  ];
  assert.equal(yearOf(stories[1].dated.facts)?.provenance, "inferred");
  stories.forEach((story, ord) => {
    const storyId = insertStory({ recordingId: "rec", ord, title: `story ${ord}`, segStart: story.segStart, segEnd: story.segEnd, start: story.segStart * 5, end: story.segEnd * 5 + 4, quoteSeg: story.segStart });
    saveAnnotation({ storyId, recordingId: "rec", facts: story.dated.facts, rejected: story.dated.rejected, themes: [], questions: [], model: "test" });
  });
  rederiveArchive();

  const offsets = db().prepare("SELECT status, year_from, provenance, reason, note FROM marks WHERE kind = 'offset' ORDER BY start_sec").all() as {
    status: string;
    year_from: number | null;
    provenance: string | null;
    reason: string | null;
    note: string | null;
  }[];
  assert.equal(offsets.length, 2);
  assert.equal(offsets[0].status, "kept");
  assert.equal(offsets[0].year_from, 1960);
  assert.equal(offsets[0].provenance, "inferred");
  assert.match(offsets[0].note ?? "", /2 years after 1958/);
  assert.equal(offsets[1].status, "refused");
  assert.equal(offsets[1].year_from, null);
  assert.match(offsets[1].reason ?? "", /No year is said before it in this story/);
});

test("no evidence means no date: nothing is filled in with an approximate year", () => {
  const carry = periodCarrier(1948);
  for (let i = 0; i < 3; i++) {
    const story = carry([]);
    assert.equal(yearOf(story.facts), null);
    assert.deepEqual(story.rejected, []);
  }

  const segments: Segment[] = [{ idx: 0, start: 0, end: 4, text: "A gente costurava até de madrugada.", words: null, confidence: null }];
  const { facts, rejected } = verify(
    {
      people: [],
      places: [],
      times: [{ label: "1978", yearFrom: 1978, yearTo: 1978, mention: "até de madrugada", segment: 0, explicit: false, reason: "Around the move." }],
      lifeStage: null,
      themes: [],
      questions: [],
    },
    segments,
    { from: 0, to: 0 },
    "Rosa",
    1948,
  );
  assert.equal(yearOf(facts), null);
  assert.equal(rejected[0].kind, "time");
  assert.equal(yearOf(periodCarrier(1948)(facts).facts), null);
});

test("the refusal to carry an inferred year is kept even when the story's own words also give its stage of life", () => {
  const stated: VerifiedFact = {
    kind: "life_stage",
    value: "adulthood",
    detail: null,
    yearFrom: null,
    yearTo: null,
    provenance: "extracted",
    primary: true,
    seg: 0,
    evidence: "quando eu já era adulta",
    start: 0,
    end: 1,
    note: null,
  };
  const carry = periodCarrier(1948);
  carry([said(1978)]);
  carry([]);
  const third = carry([stated]);
  assert.equal(yearOf(third.facts), null);
  assert.deepEqual(third.facts, [stated]);
  assert.equal(third.rejected.length, 1);
  assert.match(third.rejected[0].reason, /only by inference/);
});

test("refusals are kept only where they explain something: a story with its own year needs none, and nothing cascades", () => {
  const carry = periodCarrier(1948);
  carry([said(1978)]);
  carry([]);
  assert.deepEqual(carry([said(1985)]).rejected, []);

  const again = periodCarrier(1948);
  again([said(1978)]);
  again([]);
  assert.equal(again([]).rejected.length, 1);
  assert.deepEqual(again([]).rejected, []);
});
