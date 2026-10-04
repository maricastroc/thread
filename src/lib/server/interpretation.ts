import "server-only";
import type { EntityKind, EntitySummary, Fact, LiveStory, Provenance, Quote, Segment, StorySummary, Theme } from "@/lib/types";
import { db, num, str, transaction, type Row } from "./db";
import { getSegments } from "./evidence";
import { newId } from "./ids";
import type { KnownEntity } from "./interpreter/types";
import type { Rejection, VerifiedFact } from "./provenance";
import { normalize } from "./text";
import { whenFromFacts } from "./when";

export function deleteOrphanEntities(): number {
  const result = db()
    .prepare("DELETE FROM entities WHERE id NOT IN (SELECT entity_id FROM facts WHERE entity_id IS NOT NULL)")
    .run();
  return Number(result.changes);
}

export type MarkInput = {
  storyId: string;
  recordingId: string;
  kind: "mention" | "age" | "offset" | "duration";
  status: "kept" | "refused";
  reason: string | null;
  entityId: string | null;
  value: number | null;
  yearFrom: number | null;
  yearTo: number | null;
  anchored: boolean;
  provenance: Provenance | null;
  seg: number | null;
  evidence: string | null;
  start: number | null;
  end: number | null;
  note: string | null;
};

export function replaceMarks(marks: MarkInput[]): void {
  transaction(() => {
    const database = db();
    database.prepare("DELETE FROM marks").run();
    const insert = database.prepare(
      `INSERT INTO marks (story_id, recording_id, kind, status, reason, entity_id, value, year_from, year_to, anchored, provenance, seg, evidence, start_sec, end_sec, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const m of marks) {
      insert.run(m.storyId, m.recordingId, m.kind, m.status, m.reason, m.entityId, m.value, m.yearFrom, m.yearTo, m.anchored ? 1 : 0, m.provenance, m.seg, m.evidence, m.start, m.end, m.note);
    }
  });
}

export function keptMarks(): MarkInput[] {
  return (db().prepare("SELECT * FROM marks WHERE status = 'kept' ORDER BY story_id, start_sec").all() as Row[]).map((r) => ({
    storyId: String(r.story_id),
    recordingId: String(r.recording_id),
    kind: String(r.kind) as MarkInput["kind"],
    status: "kept" as const,
    reason: null,
    entityId: str(r.entity_id),
    value: num(r.value),
    yearFrom: num(r.year_from),
    yearTo: num(r.year_to),
    anchored: Number(r.anchored) === 1,
    provenance: (str(r.provenance) as Provenance | null) ?? null,
    seg: num(r.seg),
    evidence: str(r.evidence),
    start: num(r.start_sec),
    end: num(r.end_sec),
    note: str(r.note),
  }));
}

export function allStoryRanges(): { id: string; recordingId: string; segStart: number; segEnd: number; start: number; end: number }[] {
  return (db().prepare("SELECT id, recording_id, seg_start, seg_end, start_sec, end_sec FROM stories ORDER BY recording_id, ord").all() as Row[]).map((r) => ({
    id: String(r.id),
    recordingId: String(r.recording_id),
    segStart: Number(r.seg_start),
    segEnd: Number(r.seg_end),
    start: Number(r.start_sec),
    end: Number(r.end_sec),
  }));
}

export type PreviousStory = { id: string; start: number; end: number; title: string; titleBy: "archive" | "family" };

export function clearInterpretation(recordingId: string): PreviousStory[] {
  const previous = (
    db().prepare("SELECT id, start_sec, end_sec, title, title_by FROM stories WHERE recording_id = ?").all(recordingId) as Row[]
  ).map((r) => ({
    id: String(r.id),
    start: Number(r.start_sec),
    end: Number(r.end_sec),
    title: String(r.title),
    titleBy: r.title_by === "family" ? ("family" as const) : ("archive" as const),
  }));
  transaction(() => {
    db().prepare("DELETE FROM chunks WHERE recording_id = ?").run(recordingId);
    db().prepare("DELETE FROM stories WHERE recording_id = ?").run(recordingId);
    deleteOrphanEntities();
  });
  return previous;
}

export function insertStory(input: {
  id?: string;
  recordingId: string;
  ord: number;
  title: string;
  titleBy?: "archive" | "family";
  segStart: number;
  segEnd: number;
  start: number;
  end: number;
  quoteSeg: number;
}): string {
  const id = input.id ?? newId();
  db()
    .prepare(
      `INSERT INTO stories (id, recording_id, ord, title, title_by, seg_start, seg_end, start_sec, end_sec, quote_seg)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, input.recordingId, input.ord, input.title, input.titleBy ?? "archive", input.segStart, input.segEnd, input.start, input.end, input.quoteSeg);
  return id;
}

function resolveEntity(kind: EntityKind, entity: NonNullable<VerifiedFact["entity"]>): string {
  const database = db();
  const key = normalize(entity.name);
  let row = database.prepare("SELECT * FROM entities WHERE kind = ? AND norm = ?").get(kind, key) as Row | undefined;
  if (!row) {
    const candidates = database.prepare("SELECT * FROM entities WHERE kind = ?").all(kind) as Row[];
    const wanted = new Set([key, ...entity.aliases.map(normalize)]);
    row = candidates.find((c) => {
      const aliases = (JSON.parse(String(c.aliases)) as string[]).map(normalize);
      return aliases.some((a) => wanted.has(a)) || wanted.has(String(c.norm));
    });
  }
  if (row) {
    const aliases = new Set(JSON.parse(String(row.aliases)) as string[]);
    for (const alias of entity.aliases) if (normalize(alias) !== String(row.norm)) aliases.add(alias);
    const current = String(row.name);
    const name = current === current.toUpperCase() && entity.name !== entity.name.toUpperCase() ? entity.name : current;
    database
      .prepare("UPDATE entities SET name = ?, aliases = ?, relation = COALESCE(relation, ?) WHERE id = ?")
      .run(name, JSON.stringify([...aliases]), entity.relation, String(row.id));
    return String(row.id);
  }
  const id = newId();
  database
    .prepare("INSERT INTO entities (id, kind, name, norm, relation, aliases) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, kind, entity.name, key, entity.relation, JSON.stringify(entity.aliases));
  return id;
}

export function saveAnnotation(input: {
  storyId: string;
  recordingId: string;
  facts: VerifiedFact[];
  rejected: Rejection[];
  themes: Theme[];
  questions: string[];
  model: string;
}): void {
  transaction(() => {
    const database = db();
    const refuse = database.prepare("INSERT INTO rejections (story_id, recording_id, kind, value, mention, reason, model) VALUES (?, ?, ?, ?, ?, ?, ?)");
    for (const r of input.rejected) refuse.run(input.storyId, input.recordingId, r.kind, r.value, r.mention, r.reason, input.model);
    const insert = database.prepare(
      `INSERT INTO facts (story_id, recording_id, kind, entity_id, value, detail, year_from, year_to, provenance, is_primary, seg, evidence, start_sec, end_sec, note, model)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const entityIds = new Map<string, string>();
    for (const fact of input.facts) {
      let entityId: string | null = null;
      if ((fact.kind === "person" || fact.kind === "place") && fact.entity) {
        const key = `${fact.kind}:${normalize(fact.value)}`;
        entityId = entityIds.get(key) ?? resolveEntity(fact.kind, fact.entity);
        entityIds.set(key, entityId);
      }
      insert.run(
        input.storyId,
        input.recordingId,
        fact.kind,
        entityId,
        fact.value,
        fact.detail,
        fact.yearFrom,
        fact.yearTo,
        fact.provenance,
        fact.primary ? 1 : 0,
        fact.seg,
        fact.evidence,
        fact.start,
        fact.end,
        fact.note,
        input.model,
      );
    }
    const existing = new Set(
      (database.prepare("SELECT text FROM questions").all() as Row[]).map((r) => normalize(String(r.text))),
    );
    const question = database.prepare("INSERT INTO questions (story_id, text, created_at) VALUES (?, ?, ?)");
    for (const q of input.questions) {
      const key = normalize(q);
      if (!key || existing.has(key)) continue;
      existing.add(key);
      question.run(input.storyId, q, new Date().toISOString());
    }
    database
      .prepare("UPDATE stories SET themes = ?, annotated = 1 WHERE id = ?")
      .run(JSON.stringify(input.themes), input.storyId);
  });
}

function toFact(row: Row): Fact & { primary: boolean } {
  return {
    id: Number(row.id),
    storyId: String(row.story_id),
    recordingId: String(row.recording_id),
    kind: String(row.kind) as Fact["kind"],
    entityId: str(row.entity_id),
    value: String(row.value),
    detail: str(row.detail),
    yearFrom: num(row.year_from),
    yearTo: num(row.year_to),
    provenance: String(row.provenance) as Provenance,
    seg: num(row.seg),
    evidence: str(row.evidence),
    start: num(row.start_sec),
    end: num(row.end_sec),
    note: str(row.note),
    primary: Number(row.is_primary) === 1,
  };
}

export function factsForStories(storyIds: string[]) {
  if (!storyIds.length) return new Map<string, ReturnType<typeof toFact>[]>();
  const rows = db()
    .prepare(`SELECT * FROM facts WHERE story_id IN (${storyIds.map(() => "?").join(",")}) ORDER BY start_sec, id`)
    .all(...storyIds) as Row[];
  const map = new Map<string, ReturnType<typeof toFact>[]>();
  for (const row of rows) {
    const fact = toFact(row);
    const list = map.get(fact.storyId) ?? [];
    list.push(fact);
    map.set(fact.storyId, list);
  }
  return map;
}

function quoteFor(row: Row): Quote | null {
  if (row.quote_text === null || row.quote_text === undefined) return null;
  return {
    seg: Number(row.quote_seg),
    text: String(row.quote_text),
    start: Number(row.quote_start),
    end: Number(row.quote_end),
  };
}

const storySelect = `
  SELECT s.*, r.language AS language, r.recorded_at AS recorded_at,
         q.text AS quote_text, q.start_sec AS quote_start, q.end_sec AS quote_end
  FROM stories s
  JOIN recordings r ON r.id = s.recording_id
  LEFT JOIN segments q ON q.recording_id = s.recording_id AND q.idx = s.quote_seg`;

function toStories(rows: Row[], birthYear: number | null): StorySummary[] {
  const facts = factsForStories(rows.map((r) => String(r.id)));
  return rows.map((row) => {
    const own = (facts.get(String(row.id)) ?? []).filter((f) => f.primary);
    return {
      id: String(row.id),
      recordingId: String(row.recording_id),
      ord: Number(row.ord),
      title: String(row.title),
      titleBy: row.title_by === "family" ? "family" : "archive",
      start: Number(row.start_sec),
      end: Number(row.end_sec),
      quote: quoteFor(row),
      when: whenFromFacts(own, birthYear),
      themes: JSON.parse(String(row.themes || "[]")) as Theme[],
      language: str(row.language),
      recordedAt: String(row.recorded_at),
    };
  });
}

export function listStories(birthYear: number | null): StorySummary[] {
  const rows = db().prepare(`${storySelect} WHERE s.annotated = 1 ORDER BY r.recorded_at, s.ord`).all() as Row[];
  return toStories(rows, birthYear);
}

export function storiesOfRecording(recordingId: string, birthYear: number | null): StorySummary[] {
  const rows = db().prepare(`${storySelect} WHERE s.recording_id = ? ORDER BY s.ord`).all(recordingId) as Row[];
  return toStories(rows, birthYear);
}

export function getStoryRow(id: string) {
  return db().prepare("SELECT * FROM stories WHERE id = ?").get(id) as Row | undefined;
}

export function getStory(id: string, birthYear: number | null) {
  const rows = db().prepare(`${storySelect} WHERE s.id = ?`).all(id) as Row[];
  if (!rows.length) return null;
  const story = toStories(rows, birthYear)[0];
  const row = rows[0];
  const segments = getSegments(story.recordingId, Number(row.seg_start), Number(row.seg_end));
  const facts = factsForStories([id]).get(id) ?? [];
  const questions = (
    db().prepare("SELECT id, text FROM questions WHERE story_id = ? AND dismissed = 0 ORDER BY id").all(id) as Row[]
  ).map((q) => ({ id: Number(q.id), text: String(q.text) }));
  return { story, segments, facts, questions };
}

export function allEntities(): { id: string; kind: EntityKind; name: string; relation: string | null; aliases: string[] }[] {
  return (db().prepare("SELECT id, kind, name, relation, aliases FROM entities").all() as Row[]).map((r) => ({
    id: String(r.id),
    kind: String(r.kind) as EntityKind,
    name: String(r.name),
    relation: str(r.relation),
    aliases: JSON.parse(String(r.aliases || "[]")) as string[],
  }));
}

export function questionsForStories(storyIds: string[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  if (!storyIds.length) return map;
  const rows = db()
    .prepare(`SELECT story_id, text FROM questions WHERE dismissed = 0 AND story_id IN (${storyIds.map(() => "?").join(",")}) ORDER BY id`)
    .all(...storyIds) as Row[];
  for (const r of rows) map.set(String(r.story_id), [...(map.get(String(r.story_id)) ?? []), String(r.text)]);
  return map;
}

export function openQuestions(limit: number): string[] {
  return (
    db().prepare("SELECT text FROM questions WHERE dismissed = 0 ORDER BY id DESC LIMIT ?").all(limit) as Row[]
  ).map((r) => String(r.text));
}

export function markQuestionAsked(text: string): void {
  db().prepare("UPDATE questions SET dismissed = 1 WHERE text = ?").run(text);
}

export function updateStoryTitle(id: string, title: string): void {
  db().prepare("UPDATE stories SET title = ? WHERE id = ? AND title_by = 'archive'").run(title, id);
}

export function renameStory(id: string, title: string): void {
  db().prepare("UPDATE stories SET title = ?, title_by = 'family' WHERE id = ?").run(title, id);
}

export function liveStories(recordingId: string, birthYear: number | null): LiveStory[] {
  const rows = db().prepare("SELECT * FROM stories WHERE recording_id = ? ORDER BY ord").all(recordingId) as Row[];
  const facts = factsForStories(rows.map((r) => String(r.id)));
  return rows.map((row) => {
    const own = (facts.get(String(row.id)) ?? []).filter((f) => f.primary);
    return {
      id: String(row.id),
      ord: Number(row.ord),
      title: String(row.title),
      start: Number(row.start_sec),
      end: Number(row.end_sec),
      annotated: Number(row.annotated) === 1,
      people: own.filter((f) => f.kind === "person").map((f) => f.value),
      places: own.filter((f) => f.kind === "place").map((f) => f.value),
      when: whenFromFacts(own, birthYear),
    };
  });
}

export function knownEntities(): { people: KnownEntity[]; places: KnownEntity[] } {
  const rows = db()
    .prepare(
      `SELECT e.name, e.kind, e.relation, e.aliases, COUNT(f.id) AS uses
       FROM entities e JOIN facts f ON f.entity_id = e.id
       GROUP BY e.id ORDER BY uses DESC`,
    )
    .all() as Row[];
  const map = (kind: string) =>
    rows
      .filter((r) => r.kind === kind)
      .map((r) => ({ name: String(r.name), relation: str(r.relation), aliases: JSON.parse(String(r.aliases)) as string[] }));
  return { people: map("person"), places: map("place") };
}

export function listEntities(kind: EntityKind): EntitySummary[] {
  const rows = db()
    .prepare(
      `SELECT e.id, e.kind, e.name, e.relation,
              COUNT(DISTINCT f.story_id) AS stories, COUNT(f.id) AS moments
       FROM entities e
       JOIN facts f ON f.entity_id = e.id
       JOIN stories s ON s.id = f.story_id AND s.annotated = 1
       WHERE e.kind = ?
       GROUP BY e.id
       ORDER BY stories DESC, moments DESC, e.name COLLATE NOCASE`,
    )
    .all(kind) as Row[];
  return rows.map((r) => ({
    id: String(r.id),
    kind,
    name: String(r.name),
    relation: str(r.relation),
    storyCount: Number(r.stories),
    momentCount: Number(r.moments),
  }));
}

export function getEntity(id: string, birthYear: number | null) {
  const row = db().prepare("SELECT * FROM entities WHERE id = ?").get(id) as Row | undefined;
  if (!row) return null;
  const facts = (
    db().prepare("SELECT * FROM facts WHERE entity_id = ? ORDER BY story_id, start_sec").all(id) as Row[]
  ).map(toFact);
  const storyIds = [...new Set(facts.map((f) => f.storyId))];
  const stories = storyIds.length
    ? toStories(
        db().prepare(`${storySelect} WHERE s.id IN (${storyIds.map(() => "?").join(",")}) AND s.annotated = 1`).all(...storyIds) as Row[],
        birthYear,
      )
    : [];
  const segmentText = new Map<string, Segment>();
  for (const fact of facts) {
    if (fact.seg === null) continue;
    const key = `${fact.recordingId}:${fact.seg}`;
    if (!segmentText.has(key)) {
      const seg = getSegments(fact.recordingId, fact.seg, fact.seg)[0];
      if (seg) segmentText.set(key, seg);
    }
  }
  return {
    entity: {
      id: String(row.id),
      kind: String(row.kind) as EntityKind,
      name: String(row.name),
      relation: str(row.relation),
      aliases: JSON.parse(String(row.aliases)) as string[],
    },
    stories,
    facts,
    segments: segmentText,
  };
}

export function relatedStories(storyId: string, birthYear: number | null, limit = 3) {
  const rows = db()
    .prepare(
      `SELECT f2.story_id AS id, GROUP_CONCAT(DISTINCT e.name) AS shared, COUNT(DISTINCT e.id) AS n
       FROM facts f1
       JOIN facts f2 ON f2.entity_id = f1.entity_id AND f2.story_id != f1.story_id
       JOIN entities e ON e.id = f1.entity_id
       JOIN stories s ON s.id = f2.story_id AND s.annotated = 1
       WHERE f1.story_id = ? AND f1.entity_id IS NOT NULL
       GROUP BY f2.story_id
       ORDER BY n DESC
       LIMIT ?`,
    )
    .all(storyId, limit) as Row[];
  if (!rows.length) return [];
  const stories = toStories(
    db().prepare(`${storySelect} WHERE s.id IN (${rows.map(() => "?").join(",")})`).all(...rows.map((r) => String(r.id))) as Row[],
    birthYear,
  );
  return rows
    .map((r) => ({ story: stories.find((s) => s.id === String(r.id))!, shared: String(r.shared).split(",") }))
    .filter((r) => r.story);
}

export function storyTitlesForRecording(recordingId: string): Map<number, { id: string; title: string; segStart: number; segEnd: number }> {
  const rows = db().prepare("SELECT id, title, seg_start, seg_end FROM stories WHERE recording_id = ?").all(recordingId) as Row[];
  const map = new Map<number, { id: string; title: string; segStart: number; segEnd: number }>();
  for (const r of rows) {
    const info = { id: String(r.id), title: String(r.title), segStart: Number(r.seg_start), segEnd: Number(r.seg_end) };
    for (let i = info.segStart; i <= info.segEnd; i++) map.set(i, info);
  }
  return map;
}

export function archiveStats() {
  const row = db()
    .prepare(
      `SELECT COUNT(*) AS stories, COALESCE(SUM(end_sec - start_sec), 0) AS seconds
       FROM stories WHERE annotated = 1`,
    )
    .get() as Row;
  const first = db().prepare("SELECT MIN(recorded_at) AS first FROM recordings").get() as Row;
  const total = db().prepare("SELECT COALESCE(SUM(duration), 0) AS seconds FROM recordings").get() as Row;
  return {
    stories: Number(row.stories),
    storySeconds: Number(row.seconds),
    recordedSeconds: Number(total.seconds),
    firstRecordedAt: str(first.first),
  };
}

export function themeCounts(): { theme: Theme; count: number }[] {
  const rows = db().prepare("SELECT themes FROM stories WHERE annotated = 1").all() as Row[];
  const counts = new Map<Theme, number>();
  for (const r of rows) for (const theme of JSON.parse(String(r.themes || "[]")) as Theme[]) counts.set(theme, (counts.get(theme) ?? 0) + 1);
  return [...counts.entries()].map(([theme, count]) => ({ theme, count })).sort((a, b) => b.count - a.count);
}

export function storyCountsByRecording(): Map<string, number> {
  const rows = db().prepare("SELECT recording_id, COUNT(*) AS n FROM stories GROUP BY recording_id").all() as Row[];
  return new Map(rows.map((r) => [String(r.recording_id), Number(r.n)]));
}

export function entitiesOnlyIn(recordingId: string): { people: number; places: number } {
  const rows = db()
    .prepare(
      `SELECT e.kind AS kind, COUNT(*) AS n FROM entities e
       WHERE EXISTS (SELECT 1 FROM facts f WHERE f.entity_id = e.id AND f.recording_id = ?)
         AND NOT EXISTS (SELECT 1 FROM facts f WHERE f.entity_id = e.id AND f.recording_id != ?)
       GROUP BY e.kind`,
    )
    .all(recordingId, recordingId) as Row[];
  const count = (kind: string) => Number(rows.find((r) => r.kind === kind)?.n ?? 0);
  return { people: count("person"), places: count("place") };
}
