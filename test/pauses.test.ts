import assert from "node:assert/strict";
import { test } from "node:test";
import { languageName, segmentationSystem, segmentationUser } from "../src/lib/server/interpreter/prompts";
import { boundaryPauses, detectPauses, pauseEvidence } from "../src/lib/server/pauses";
import { attachLeftovers, planStories } from "../src/lib/server/structure";
import { loadFixture, sentenceWith, transcriptGaps } from "./pause-fixtures";

const PER_SECOND = 20;

function envelope(parts: [seconds: number, level: number][], jitter = 0.15): Uint8Array {
  let seed = 7;
  const values: number[] = [];
  for (const [seconds, level] of parts) {
    for (let i = 0; i < Math.round(seconds * PER_SECOND); i++) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      const wobble = 1 + jitter * ((seed / 2147483648) * 2 - 1);
      values.push(Math.max(0, Math.min(255, Math.round(level * wobble))));
    }
  }
  return Uint8Array.from(values);
}

const spans = (pauses: { start: number; end: number }[]) => pauses.map((p) => [p.start, p.end]);

test("a pause is quiet against the recording's own floor, whether the room is silent or noisy", () => {
  const take = (floor: number): [number, number][] => [
    [0.5, floor],
    [3, 200],
    [0.6, floor],
    [2.5, 190],
    [1.2, floor],
    [3, 210],
    [0.4, floor],
    [2, 200],
    [0.8, floor],
  ];
  for (const floor of [0, 25, 60]) {
    assert.deepEqual(spans(detectPauses(envelope(take(floor)), PER_SECOND)), [
      [3.5, 4.1],
      [6.6, 7.8],
      [10.8, 11.2],
    ]);
  }
});

test("short dips are not pauses, a brief sound does not split a pause, and the silence around the speech is not a pause", () => {
  const pauses = detectPauses(
    envelope([
      [2, 0],
      [2, 200],
      [0.2, 0],
      [2, 200],
      [1, 0],
      [0.1, 200],
      [0.8, 0],
      [2, 200],
      [3, 0],
    ]),
    PER_SECOND,
  );
  assert.deepEqual(spans(pauses), [[6.2, 8.1]]);
});

test("continuous sound without quiet moments has no pauses", () => {
  assert.deepEqual(detectPauses(envelope([[20, 200]], 0.1), PER_SECOND), []);
});

const fortaleza = loadFixture("human-fortaleza");
const house = sentenceWith(fortaleza, "A primeira casa");
const sewing = sentenceWith(fortaleza, "pra ajudar em casa");
const closing = sentenceWith(fortaleza, "E é isso");
const marcos = sentenceWith(fortaleza, "O Marcos");

test("Fortaleza, human reading: the silences heard in the audio are found", () => {
  const pauses = detectPauses(fortaleza.peaks, fortaleza.perSecond);
  for (const [start, end] of [
    [34.0, 35.8],
    [60.5, 62.3],
    [92.8, 94.3],
  ]) {
    const found = pauses.find((p) => p.start < end && p.end > start);
    assert.ok(found, `a pause at ${start}–${end} s`);
    assert.ok(Math.abs(found.start - start) <= 0.15 && Math.abs(found.end - end) <= 0.15, `${found.start}–${found.end} s for ${start}–${end} s`);
  }
});

test("Fortaleza: the silences reach the sentence boundaries even where Whisper's timestamps show no gap", () => {
  const between = boundaryPauses(detectPauses(fortaleza.peaks, fortaleza.perSecond), fortaleza.segments);
  const pauseAfter = (idx: number) => between.find((b) => b.after === idx)?.duration ?? 0;
  const gaps = transcriptGaps(fortaleza);
  assert.ok(pauseAfter(house - 1) >= 1.5 && gaps[house - 1] < 0.2);
  assert.ok(pauseAfter(sewing - 1) >= 1.5);
  assert.ok(pauseAfter(closing - 1) >= 1.3 && gaps[closing - 1] < 0.2);
  assert.ok(gaps.every((gap) => gap < 2.5));
});

test("Fortaleza: only the pauses clearly longer than this speaker's usual pause become cues", () => {
  const evidence = pauseEvidence(fortaleza.peaks, fortaleza.perSecond, fortaleza.segments);
  assert.ok(evidence.typical !== null && evidence.typical >= 0.7 && evidence.typical <= 1.1);
  assert.deepEqual(
    evidence.cues.map((c) => c.after),
    [house - 1, sewing - 1, closing - 1],
  );
  const beforeMarcos = boundaryPauses(detectPauses(fortaleza.peaks, fortaleza.perSecond), fortaleza.segments).find((b) => b.after === marcos - 1);
  assert.ok(beforeMarcos && beforeMarcos.duration > 1);
});

test("too few pauses between sentences say nothing about the speaker's rhythm", () => {
  const opening = fortaleza.segments.slice(0, 4);
  const peaks = fortaleza.peaks.slice(0, Math.ceil((opening[3].end + 0.5) * fortaleza.perSecond));
  assert.deepEqual(pauseEvidence(peaks, fortaleza.perSecond, opening), { typical: null, cues: [] });
});

for (const { name, before } of [
  { name: "fast-speech", before: "gráfica" },
  { name: "slow-speech", before: "exército" },
  { name: "same-subject-pause", before: "Erva doce" },
  { name: "subject-change", before: "adulta" },
]) {
  test(`${name}: the one pause that stands out for this speaker is the only cue`, () => {
    const fixture = loadFixture(name);
    const evidence = pauseEvidence(fixture.peaks, fixture.perSecond, fixture.segments);
    assert.deepEqual(
      evidence.cues.map((c) => c.after),
      [sentenceWith(fixture, before) - 1],
    );
  });
}

test("fast speech: a pause of about a second stands out, far below a fixed threshold", () => {
  const fixture = loadFixture("fast-speech");
  const evidence = pauseEvidence(fixture.peaks, fixture.perSecond, fixture.segments);
  assert.ok(evidence.typical !== null && evidence.typical < 0.5);
  assert.ok(evidence.cues[0].duration < 1.5 && evidence.cues[0].ratio >= 2);
  assert.ok(transcriptGaps(fixture).every((gap) => gap < 2.5));
});

test("slow speech: long ordinary pauses are this speaker's rhythm, not cues", () => {
  const fixture = loadFixture("slow-speech");
  const evidence = pauseEvidence(fixture.peaks, fixture.perSecond, fixture.segments);
  const ordinary = boundaryPauses(detectPauses(fixture.peaks, fixture.perSecond), fixture.segments).filter(
    (b) => !evidence.cues.some((c) => c.after === b.after),
  );
  assert.ok(evidence.typical !== null && evidence.typical >= 2.5);
  assert.ok(ordinary.length >= 8);
  assert.ok(ordinary.every((b) => b.duration >= 2.5));
});

test("a change of subject marked by a pause only moderately longer than usual still gets a cue", () => {
  const fixture = loadFixture("subject-change");
  const evidence = pauseEvidence(fixture.peaks, fixture.perSecond, fixture.segments);
  const change = sentenceWith(fixture, "adulta");
  assert.ok(evidence.cues[0].ratio < 2.5);
  assert.ok(transcriptGaps(fixture)[change - 1] < 1);
});

test("the interpreter reads each cue just before the sentence after the pause, and nothing else marks pauses", () => {
  const pauses = pauseEvidence(fortaleza.peaks, fortaleza.perSecond, fortaleza.segments);
  const input = { narrator: "N", recordedAt: "2026-09-27T15:00:00.000Z", prompt: null, language: "pt", segments: fortaleza.segments, pauses };
  const user = segmentationUser(input, languageName("pt"), fortaleza.segments);
  const lines = user.split("\n");
  const followed = lines.flatMap((line, i) => (line.startsWith("— longer pause") ? [Number(/^\[(\d+)\]/.exec(lines[i + 1])?.[1])] : []));
  assert.deepEqual(followed, [house, sewing, closing]);
  assert.ok(lines.includes(`Usual pause between sentences in this recording: ${pauses.typical} s`));
  assert.ok(!/— pause \d+ s —/.test(user));
  assert.match(segmentationSystem("N", languageName("pt")), /A longer pause is a hint, not a rule/);

  const unknown = segmentationUser({ ...input, pauses: { typical: null, cues: [] } }, languageName("pt"), fortaleza.segments);
  assert.ok(!unknown.includes("— longer pause") && !unknown.includes("Usual pause"));
});

test("a cue never starts a story on its own: story boundaries come only from the interpretation", () => {
  const fixture = loadFixture("same-subject-pause");
  const last = fixture.segments[fixture.segments.length - 1].idx;
  const planned = attachLeftovers(planStories([{ firstSegment: 0, lastSegment: last, title: "Bolo de milho da avó", quoteSegment: 1 }], fixture.segments), fixture.segments);
  assert.deepEqual(
    planned.map((p) => [p.segStart, p.segEnd]),
    [[0, last]],
  );
});
