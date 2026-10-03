import "server-only";
import type { RecordingSummary, Segment, Stage, WorkStage } from "@/lib/types";
import { db, num, str, transaction, type Row } from "./db";

export type RecordingError = { message: string; detail: string };

function parseError(value: unknown): RecordingError | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(String(value));
    return { message: String(parsed.message ?? ""), detail: String(parsed.detail ?? "") };
  } catch {
    return { message: String(value), detail: "" };
  }
}

function toRecording(row: Row): RecordingSummary & { originalFile: string; error: RecordingError | null } {
  return {
    id: String(row.id),
    source: row.source === "imported" ? "imported" : "recorded",
    recordedAt: String(row.recorded_at),
    duration: num(row.duration),
    prompt: str(row.prompt),
    stage: String(row.stage) as Stage,
    progress: Number(row.progress ?? 0),
    detail: str(row.detail),
    failedStage: (str(row.failed_stage) as WorkStage | null) ?? null,
    error: parseError(row.error),
    language: str(row.language),
    originalFile: String(row.original_file),
  };
}

const recordingColumns =
  "id, source, recorded_at, original_file, duration, prompt, stage, progress, detail, failed_stage, error, language";

export function createRecording(input: {
  id: string;
  source: "recorded" | "imported";
  recordedAt: string;
  originalFile: string;
  originalName: string | null;
  mime: string | null;
  prompt: string | null;
}): void {
  db()
    .prepare(
      `INSERT INTO recordings (id, source, recorded_at, created_at, original_file, original_name, mime, prompt, stage)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'preserving')`,
    )
    .run(
      input.id,
      input.source,
      input.recordedAt,
      new Date().toISOString(),
      input.originalFile,
      input.originalName,
      input.mime,
      input.prompt,
    );
}

export function getRecording(id: string) {
  const row = db().prepare(`SELECT ${recordingColumns} FROM recordings WHERE id = ?`).get(id) as Row | undefined;
  return row ? toRecording(row) : null;
}

export function listRecordings() {
  return (db().prepare(`SELECT ${recordingColumns} FROM recordings ORDER BY recorded_at DESC`).all() as Row[]).map(toRecording);
}

export function pendingRecordingIds(): string[] {
  return (
    db().prepare("SELECT id FROM recordings WHERE stage != 'ready' AND failed_stage IS NULL ORDER BY created_at").all() as Row[]
  ).map((r) => String(r.id));
}

export function updateRecording(
  id: string,
  patch: Partial<{
    stage: Stage;
    progress: number;
    detail: string | null;
    failedStage: WorkStage | null;
    error: RecordingError | null;
    duration: number;
    peaks: Uint8Array;
    language: string | null;
    models: Record<string, string>;
  }>,
): void {
  const sets: string[] = [];
  const values: (string | number | null | Uint8Array)[] = [];
  const add = (column: string, value: string | number | null | Uint8Array) => {
    sets.push(`${column} = ?`);
    values.push(value);
  };
  if (patch.stage !== undefined) add("stage", patch.stage);
  if (patch.progress !== undefined) add("progress", patch.progress);
  if (patch.detail !== undefined) add("detail", patch.detail);
  if (patch.failedStage !== undefined) add("failed_stage", patch.failedStage);
  if (patch.error !== undefined) add("error", patch.error ? JSON.stringify(patch.error) : null);
  if (patch.duration !== undefined) add("duration", patch.duration);
  if (patch.peaks !== undefined) add("peaks", patch.peaks);
  if (patch.language !== undefined) add("language", patch.language);
  if (patch.models !== undefined) {
    const row = db().prepare("SELECT models FROM recordings WHERE id = ?").get(id) as Row | undefined;
    const current = row ? JSON.parse(String(row.models || "{}")) : {};
    add("models", JSON.stringify({ ...current, ...patch.models }));
  }
  if (!sets.length) return;
  db()
    .prepare(`UPDATE recordings SET ${sets.join(", ")} WHERE id = ?`)
    .run(...values, id);
}

export function deleteRecordingRow(id: string): void {
  db().prepare("DELETE FROM recordings WHERE id = ?").run(id);
}

export function getPeaks(id: string): Uint8Array | null {
  const row = db().prepare("SELECT peaks FROM recordings WHERE id = ?").get(id) as Row | undefined;
  return row?.peaks instanceof Uint8Array ? row.peaks : null;
}

function toSegment(row: Row): Segment {
  const words = row.words ? (JSON.parse(String(row.words)) as [number, number, string, number][]) : null;
  return {
    idx: Number(row.idx),
    start: Number(row.start_sec),
    end: Number(row.end_sec),
    text: String(row.text),
    words: words ? words.map(([start, end, text, p]) => ({ start, end, text, p })) : null,
    confidence: num(row.confidence),
  };
}

export function replaceSegments(recordingId: string, segments: Segment[]): void {
  transaction(() => {
    db().prepare("DELETE FROM segments WHERE recording_id = ?").run(recordingId);
    const insert = db().prepare(
      "INSERT INTO segments (recording_id, idx, start_sec, end_sec, text, words, confidence) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    for (const s of segments) {
      const words = s.words ? JSON.stringify(s.words.map((w) => [round(w.start), round(w.end), w.text, w.p])) : null;
      insert.run(recordingId, s.idx, s.start, s.end, s.text, words, s.confidence);
    }
  });
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function getSegments(recordingId: string, from = 0, to = Number.MAX_SAFE_INTEGER): Segment[] {
  return (
    db()
      .prepare("SELECT * FROM segments WHERE recording_id = ? AND idx BETWEEN ? AND ? ORDER BY idx")
      .all(recordingId, from, to) as Row[]
  ).map(toSegment);
}
