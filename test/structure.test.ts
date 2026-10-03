import assert from "node:assert/strict";
import { test } from "node:test";
import { attachLeftovers, planStories, uncovered } from "../src/lib/server/structure";
import type { Segment } from "../src/lib/types";

const segments: Segment[] = Array.from({ length: 8 }, (_, idx) => ({
  idx,
  start: idx * 5,
  end: idx * 5 + 4.5,
  text: `Frase número ${idx} da gravação, com palavras suficientes para contar.`,
  words: null,
  confidence: null,
}));

test("narration the model skipped is never left outside a story", () => {
  const planned = planStories([{ firstSegment: 2, lastSegment: 4, title: "No meio", quoteSegment: null }], segments);
  assert.deepEqual(uncovered(planned, segments), [
    { from: 0, to: 1 },
    { from: 5, to: 7 },
  ]);
  const covered = attachLeftovers(planned, segments);
  assert.deepEqual(uncovered(covered, segments), []);
  assert.equal(covered[0].segStart, 0);
  assert.equal(covered[covered.length - 1].segEnd, 7);
});

test("separate stories keep their boundaries", () => {
  const planned = planStories(
    [
      { firstSegment: 0, lastSegment: 3, title: "Primeira", quoteSegment: null },
      { firstSegment: 4, lastSegment: 7, title: "Segunda", quoteSegment: null },
    ],
    segments,
  );
  assert.equal(planned.length, 2);
  assert.deepEqual(uncovered(attachLeftovers(planned, segments), segments), []);
});

test("no story found means no story, never an artificial one", () => {
  const planned = planStories([], segments);
  assert.deepEqual(planned, []);
  assert.deepEqual(attachLeftovers(planned, segments), []);
});
