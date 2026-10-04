import "server-only";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config";

export type Row = Record<string, unknown>;

export const str = (v: unknown) => (v === null || v === undefined ? null : String(v));
export const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

const SCHEMA = `
CREATE TABLE IF NOT EXISTS vault (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  narrator TEXT NOT NULL,
  birth_year INTEGER,
  language TEXT NOT NULL DEFAULT 'auto',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recordings (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  original_file TEXT NOT NULL,
  original_name TEXT,
  mime TEXT,
  prompt TEXT,
  duration REAL,
  stage TEXT NOT NULL,
  progress REAL NOT NULL DEFAULT 0,
  detail TEXT,
  failed_stage TEXT,
  error TEXT,
  language TEXT,
  peaks BLOB,
  models TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS segments (
  recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL,
  start_sec REAL NOT NULL,
  end_sec REAL NOT NULL,
  text TEXT NOT NULL,
  words TEXT,
  confidence REAL,
  PRIMARY KEY (recording_id, idx)
);

CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY,
  recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  ord INTEGER NOT NULL,
  title TEXT NOT NULL,
  title_by TEXT NOT NULL DEFAULT 'archive',
  seg_start INTEGER NOT NULL,
  seg_end INTEGER NOT NULL,
  start_sec REAL NOT NULL,
  end_sec REAL NOT NULL,
  quote_seg INTEGER,
  themes TEXT NOT NULL DEFAULT '[]',
  annotated INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  norm TEXT NOT NULL,
  relation TEXT,
  aliases TEXT NOT NULL DEFAULT '[]',
  UNIQUE (kind, norm)
);

CREATE TABLE IF NOT EXISTS facts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
  value TEXT NOT NULL,
  detail TEXT,
  year_from INTEGER,
  year_to INTEGER,
  provenance TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 1,
  seg INTEGER,
  evidence TEXT,
  start_sec REAL,
  end_sec REAL,
  note TEXT,
  model TEXT
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id TEXT REFERENCES stories(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  dismissed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  story_id TEXT REFERENCES stories(id) ON DELETE CASCADE,
  seg_start INTEGER NOT NULL,
  seg_end INTEGER NOT NULL,
  start_sec REAL NOT NULL,
  end_sec REAL NOT NULL,
  text TEXT NOT NULL,
  embedding BLOB,
  model TEXT
);

CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  text,
  content = 'chunks',
  content_rowid = 'id',
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS chunks_after_insert AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts (rowid, text) VALUES (new.id, new.text);
END;

CREATE TRIGGER IF NOT EXISTS chunks_after_delete AFTER DELETE ON chunks BEGIN
  INSERT INTO chunks_fts (chunks_fts, rowid, text) VALUES ('delete', old.id, old.text);
END;

CREATE TABLE IF NOT EXISTS rejections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  value TEXT NOT NULL,
  mention TEXT,
  reason TEXT NOT NULL,
  model TEXT
);

CREATE TABLE IF NOT EXISTS marks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT,
  entity_id TEXT REFERENCES entities(id) ON DELETE CASCADE,
  value REAL,
  year_from INTEGER,
  year_to INTEGER,
  anchored INTEGER NOT NULL DEFAULT 0,
  provenance TEXT,
  seg INTEGER,
  evidence TEXT,
  start_sec REAL,
  end_sec REAL,
  note TEXT
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS marks_story ON marks (story_id);
CREATE INDEX IF NOT EXISTS facts_story ON facts (story_id);
CREATE INDEX IF NOT EXISTS facts_entity ON facts (entity_id);
CREATE INDEX IF NOT EXISTS stories_recording ON stories (recording_id, ord);
CREATE INDEX IF NOT EXISTS chunks_recording ON chunks (recording_id);
`;

type Holder = { db?: DatabaseSync; schema?: string };
const holder = globalThis as unknown as { __cofreDb?: Holder };
holder.__cofreDb ??= {};

function copySnapshot(): void {
  const partial = `${config.dataDir}.partial`;
  fs.rmSync(partial, { recursive: true, force: true });
  fs.cpSync(config.snapshotDir, partial, { recursive: true });
  fs.rmSync(config.dataDir, { recursive: true, force: true });
  fs.renameSync(partial, config.dataDir);
}

export function db(): DatabaseSync {
  const h = holder.__cofreDb!;
  if (h.db) {
    if (h.schema !== SCHEMA) {
      h.db.exec(SCHEMA);
      h.schema = SCHEMA;
    }
    return h.db;
  }
  if (config.readOnly && !fs.existsSync(path.join(config.dataDir, "cofre.db"))) copySnapshot();
  fs.mkdirSync(config.dataDir, { recursive: true });
  const database = new DatabaseSync(path.join(config.dataDir, "cofre.db"));
  database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  database.exec(SCHEMA);
  h.db = database;
  h.schema = SCHEMA;
  return database;
}

export function transaction<T>(fn: () => T): T {
  const database = db();
  database.exec("BEGIN");
  try {
    const result = fn();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function recordingDir(id: string): string {
  return path.join(config.dataDir, "recordings", id);
}
