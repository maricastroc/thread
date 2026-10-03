import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

const dir = mkdtempSync(path.join(tmpdir(), "thread-test-"));
process.env.COFRE_DATA_DIR = dir;
after(() => rmSync(dir, { recursive: true, force: true }));

test("removing a recording leaves no orphan stories, facts, marks or entities", async () => {
  const { db } = await import("../src/lib/server/db");
  const { saveVault } = await import("../src/lib/server/archive");
  const { createRecording, deleteRecordingRow, replaceSegments, updateRecording } = await import("../src/lib/server/evidence");
  const { deleteOrphanEntities, insertStory, saveAnnotation } = await import("../src/lib/server/interpretation");
  const { rederiveArchive } = await import("../src/lib/server/derive");

  saveVault({ subject: "Armando", birthYear: 1939, language: "pt" });
  const recording = (id: string, text: string[]) => {
    createRecording({ id, source: "imported", recordedAt: "2026-08-02T10:00:00Z", originalFile: "original.m4a", originalName: `${id}.m4a`, mime: "audio/mp4", prompt: null });
    replaceSegments(id, text.map((t, idx) => ({ idx, start: idx * 5, end: idx * 5 + 4, text: t, words: null, confidence: null })));
    updateRecording(id, { stage: "ready", duration: text.length * 5 });
  };
  recording("one", ["A minha irmã Bia morava em Olinda.", "Eu tinha 7 anos."]);
  recording("two", ["A Bia veio para o casamento em Lisboa."]);

  const story = (recordingId: string, segEnd: number) =>
    insertStory({ recordingId, ord: 0, title: recordingId, segStart: 0, segEnd, start: 0, end: (segEnd + 1) * 5, quoteSeg: 0 });
  const person = (name: string, start: number) => ({
    kind: "person" as const,
    value: name,
    detail: null,
    yearFrom: null,
    yearTo: null,
    provenance: "said" as const,
    primary: true,
    seg: 0,
    evidence: name,
    start,
    end: start + 1,
    note: null,
    entity: { name, relation: null, aliases: [] },
  });
  const place = (name: string, start: number) => ({ ...person(name, start), kind: "place" as const });

  const first = story("one", 1);
  saveAnnotation({ storyId: first, recordingId: "one", facts: [person("Bia", 1), place("Olinda", 3)], rejected: [{ kind: "place", value: "rio", mention: "rio", reason: "generic" }], themes: [], questions: [], model: "test" });
  const second = story("two", 0);
  saveAnnotation({ storyId: second, recordingId: "two", facts: [person("Bia", 0.5), place("Lisboa", 3)], rejected: [], themes: [], questions: [], model: "test" });
  rederiveArchive();

  const count = (sql: string, ...args: string[]) => Number((db().prepare(sql).get(...args) as { n: number }).n);
  assert.ok(count("SELECT COUNT(*) AS n FROM marks WHERE recording_id = ?", "one") > 0);

  deleteRecordingRow("one");
  deleteOrphanEntities();
  rederiveArchive();

  for (const table of ["stories", "facts", "marks", "rejections", "segments"]) {
    assert.equal(count(`SELECT COUNT(*) AS n FROM ${table} WHERE recording_id = ?`, "one"), 0, `${table} of the removed recording`);
  }
  const names = (db().prepare("SELECT name FROM entities ORDER BY name").all() as { name: string }[]).map((r) => r.name);
  assert.deepEqual(names, ["Bia", "Lisboa"], "Olinda only appeared in the removed recording; Bia is still supported by the other one");
  assert.equal(count("SELECT COUNT(*) AS n FROM stories WHERE recording_id = ?", "two"), 1);
});
