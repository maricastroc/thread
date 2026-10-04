import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { GemmaInterpreter } from "../src/lib/server/interpreter/gemma";
import { pauseEvidence } from "../src/lib/server/pauses";
import { attachLeftovers, planStories } from "../src/lib/server/structure";
import { loadFixture, sentenceWith, type PauseFixture } from "./pause-fixtures";

const skip = process.env.COFRE_MODEL_TESTS === "1" ? false : "set COFRE_MODEL_TESTS=1 to ask the local model";

const divisions = new Map<string, Promise<number[]>>();

function divide(t: TestContext, fixture: PauseFixture, narrator: string, recordedAt = "2026-07-01T10:00:00.000Z"): Promise<number[]> {
  const key = `${fixture.name}:${narrator}`;
  if (!divisions.has(key)) {
    divisions.set(
      key,
      (async () => {
        const drafts = await new GemmaInterpreter().findStories({
          narrator,
          recordedAt,
          prompt: null,
          language: "pt",
          segments: fixture.segments,
          pauses: pauseEvidence(fixture.peaks, fixture.perSecond, fixture.segments),
        });
        const planned = attachLeftovers(planStories(drafts, fixture.segments), fixture.segments);
        t.diagnostic(`${key}: ${planned.map((s) => `[${s.segStart}–${s.segEnd}] ${s.title}`).join(" · ")}`);
        return planned.map((s) => s.segStart);
      })(),
    );
  }
  return divisions.get(key)!;
}

test("fast speech: a new story starts where the subject changes at the pause, and nowhere else", { skip }, async (t) => {
  const fixture = loadFixture("fast-speech");
  assert.deepEqual(await divide(t, fixture, "Tomás"), [0, sentenceWith(fixture, "gráfica")]);
});

test("slow speech: the long ordinary pauses do not split the stories", { skip }, async (t) => {
  const fixture = loadFixture("slow-speech");
  assert.deepEqual(await divide(t, fixture, "Severino"), [0, sentenceWith(fixture, "exército")]);
});

test("a long pause inside one memory does not split it", { skip }, async (t) => {
  const fixture = loadFixture("same-subject-pause");
  assert.deepEqual(await divide(t, fixture, "Rosa"), [0]);
});

test("a clear change of subject at a moderately longer pause starts a new story", { skip }, async (t) => {
  const fixture = loadFixture("subject-change");
  assert.deepEqual(await divide(t, fixture, "Celina"), [0, sentenceWith(fixture, "adulta")]);
});

const fortaleza = loadFixture("human-fortaleza");
const recordedAt = "2026-09-27T15:00:00.000Z";

test("Fortaleza: the arrival by the sea and the sewing are never one story", { skip }, async (t) => {
  const starts = await divide(t, fortaleza, "Kiara", recordedAt);
  const storyOf = (idx: number) => starts.filter((s) => s <= idx).length;
  assert.notEqual(storyOf(sentenceWith(fortaleza, "beira-mar")), storyOf(sentenceWith(fortaleza, "vestido de noiva")));
});

test("Fortaleza: the division does not depend on the narrator's name", { skip }, async (t) => {
  assert.deepEqual(await divide(t, fortaleza, "Lúcia", recordedAt), await divide(t, fortaleza, "Kiara", recordedAt));
});
