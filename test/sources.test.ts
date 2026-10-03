import assert from "node:assert/strict";
import { test } from "node:test";
import { outcomeOf } from "../src/lib/sources";

test("every recording has an explicit outcome", () => {
  assert.deepEqual(outcomeOf({ stage: "transcribing", failedStage: null, segments: 0, stories: 0 }), { kind: "working", stage: "transcribing" });
  assert.deepEqual(outcomeOf({ stage: "organizing", failedStage: "organizing", segments: 12, stories: 0 }), { kind: "failed", stage: "organizing", transcript: true });
  assert.deepEqual(outcomeOf({ stage: "ready", failedStage: null, segments: 12, stories: 3 }), { kind: "stories", count: 3 });
  assert.deepEqual(outcomeOf({ stage: "ready", failedStage: null, segments: 12, stories: 0 }), { kind: "no-stories" });
  assert.deepEqual(outcomeOf({ stage: "ready", failedStage: null, segments: 0, stories: 0 }), { kind: "no-speech" });
});
