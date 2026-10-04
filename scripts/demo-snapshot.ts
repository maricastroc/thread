import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const source = path.resolve(process.argv[2] ?? "data");
const target = path.resolve("demo/archive");
const demoFiles = new Set(
  fs
    .readdirSync("demo/roteiros")
    .filter((file) => file.endsWith(".txt"))
    .map((file) => file.replace(/\.txt$/, ".m4a")),
);

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
const archive = new DatabaseSync(path.join(source, "cofre.db"), { readOnly: true });
archive.exec(`VACUUM INTO '${path.join(target, "cofre.db").replace(/'/g, "''")}'`);
archive.close();

process.env.COFRE_DATA_DIR = target;
const { db } = await import("../src/lib/server/db");
const { deleteRecordingRow } = await import("../src/lib/server/evidence");
const { deleteOrphanEntities } = await import("../src/lib/server/interpretation");
const { rederiveArchive } = await import("../src/lib/server/derive");

type RecordingRow = { id: string; original_name: string | null; original_file: string; stage: string };
const recordings = db().prepare("SELECT id, original_name, original_file, stage FROM recordings").all() as RecordingRow[];
const kept = recordings.filter((r) => r.original_name && demoFiles.has(r.original_name) && r.stage === "ready");
for (const recording of recordings) if (!kept.includes(recording)) deleteRecordingRow(recording.id);
deleteOrphanEntities();
rederiveArchive();
db().exec("PRAGMA journal_mode = DELETE");
db().exec("VACUUM");

for (const recording of kept) {
  const dir = path.join(target, "recordings", recording.id);
  fs.mkdirSync(dir, { recursive: true });
  for (const file of ["audio.m4a", recording.original_file]) {
    fs.copyFileSync(path.join(source, "recordings", recording.id, file), path.join(dir, file));
  }
}

const count = (table: string) => (db().prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
console.log(`  ${kept.map((r) => r.original_name).join(", ")}`);
console.log(`  ${count("stories")} stories, ${count("facts")} facts, ${count("entities")} people and places, ${count("chunks")} search moments`);
