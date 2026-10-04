import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

const dir = mkdtempSync(path.join(tmpdir(), "thread-entities-"));
process.env.COFRE_DATA_DIR = dir;
after(() => rmSync(dir, { recursive: true, force: true }));

test("after a recording is interpreted again, an old entity can't lend its name to what is said now", async () => {
  const { db } = await import("../src/lib/server/db");
  const { saveVault } = await import("../src/lib/server/archive");
  const { createRecording, replaceSegments, updateRecording } = await import("../src/lib/server/evidence");
  const { clearInterpretation, insertStory, saveAnnotation } = await import("../src/lib/server/interpretation");

  saveVault({ subject: "Rosa", birthYear: 1940, language: "pt" });
  const recording = (id: string, text: string[]) => {
    createRecording({ id, source: "imported", recordedAt: "2026-08-02T10:00:00Z", originalFile: "original.m4a", originalName: `${id}.m4a`, mime: "audio/mp4", prompt: null });
    replaceSegments(id, text.map((t, idx) => ({ idx, start: idx * 5, end: idx * 5 + 4, text: t, words: null, confidence: null })));
    updateRecording(id, { stage: "ready", duration: text.length * 5 });
  };
  recording("again", ["Eu nasci em Birajá, perto do rio.", "O José era o nosso vizinho."]);
  recording("other", ["O José tocava sanfona em Olinda."]);

  const story = (recordingId: string, segEnd: number) =>
    insertStory({ recordingId, ord: 0, title: recordingId, segStart: 0, segEnd, start: 0, end: (segEnd + 1) * 5, quoteSeg: 0 });
  const fact = (kind: "person" | "place", value: string, seg: number, aliases: string[] = []) => ({
    kind,
    value,
    detail: null,
    yearFrom: null,
    yearTo: null,
    provenance: "said" as const,
    primary: true,
    seg,
    evidence: value,
    start: seg * 5,
    end: seg * 5 + 1,
    note: null,
    entity: { name: value, relation: null, aliases },
  });
  const save = (storyId: string, recordingId: string, facts: ReturnType<typeof fact>[]) =>
    saveAnnotation({ storyId, recordingId, facts, rejected: [], themes: [], questions: [], model: "test" });
  const entityOf = (recordingId: string, value: string) =>
    db().prepare("SELECT e.id, e.name FROM facts f JOIN entities e ON e.id = f.entity_id WHERE f.recording_id = ? AND f.value = ?").get(recordingId, value) as { id: string; name: string };
  const names = () => (db().prepare("SELECT name FROM entities ORDER BY name").all() as { name: string }[]).map((r) => r.name);

  save(story("other", 0), "other", [fact("person", "José", 0), fact("place", "Olinda", 0)]);
  save(story("again", 1), "again", [fact("place", "Ibirajá", 0, ["Birajá"]), fact("person", "José", 1)]);
  const jose = entityOf("other", "José").id;
  assert.equal(entityOf("again", "José").id, jose);

  clearInterpretation("again");
  assert.deepEqual(names(), ["José", "Olinda"], "only the old interpretation supported Ibirajá; José and Olinda are still supported by the other recording");

  save(story("again", 1), "again", [fact("place", "Birajá", 0), fact("person", "José", 1)]);
  assert.equal(entityOf("again", "Birajá").name, "Birajá");
  assert.equal(entityOf("again", "José").id, jose);
  assert.deepEqual(names(), ["Birajá", "José", "Olinda"]);
});
