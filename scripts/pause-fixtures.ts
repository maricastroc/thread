import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { analyze, convert, PEAKS_PER_SECOND } from "../src/lib/server/audio";
import { transcribe } from "../src/lib/server/whisper";
import type { Segment } from "../src/lib/types";

type Evidence = { source: string; duration: number; peaks: Uint8Array; segments: Segment[] };

const root = path.resolve("fixtures/pauses");

function save(name: string, evidence: Evidence) {
  const segments = evidence.segments.map(
    (s) =>
      `    ${JSON.stringify({
        idx: s.idx,
        start: s.start,
        end: s.end,
        text: s.text,
        confidence: s.confidence,
        words: s.words?.map((w) => [w.start, w.end, w.text, w.p]) ?? null,
      })}`,
  );
  const body = [
    "{",
    `  "source": ${JSON.stringify(evidence.source)},`,
    `  "perSecond": ${PEAKS_PER_SECOND},`,
    `  "duration": ${evidence.duration},`,
    `  "peaks": "${Buffer.from(evidence.peaks).toString("base64")}",`,
    `  "segments": [`,
    segments.join(",\n"),
    "  ]",
    "}",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(root, `${name}.json`), body);
  console.log(`  ${name}.json  ${evidence.segments.length} sentences, ${evidence.duration.toFixed(1)} s`);
}

async function synthesize(file: string, voice: string, rate: string) {
  const name = path.basename(file, ".txt");
  const audio = path.join(root, "audio");
  fs.mkdirSync(audio, { recursive: true });
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "thread-pauses-"));
  try {
    execFileSync("say", ["-v", voice, "-r", rate, "-f", path.join(root, "roteiros", file), "-o", path.join(work, "original.aiff")]);
    await convert(work, "original.aiff");
    fs.copyFileSync(path.join(work, "audio.m4a"), path.join(audio, `${name}.m4a`));
    const { duration, peaks } = await analyze(path.join(work, "speech.wav"));
    const { segments } = await transcribe(work, { language: "pt" });
    save(name, { source: `roteiros/${file}, read by the macOS voice ${voice} at ${rate} words per minute`, duration, peaks, segments });
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

type RecordingRow = { original_name: string; duration: number; peaks: Uint8Array };
type SegmentRow = { idx: number; start_sec: number; end_sec: number; text: string; words: string | null; confidence: number | null };

function fromArchive(dataDir: string, recordingId: string, name: string) {
  const db = new DatabaseSync(path.join(path.resolve(dataDir), "cofre.db"), { readOnly: true });
  const recording = db.prepare("SELECT original_name, duration, peaks FROM recordings WHERE id = ?").get(recordingId) as RecordingRow | undefined;
  if (!recording) throw new Error(`No recording ${recordingId} in ${dataDir}`);
  const rows = db
    .prepare("SELECT idx, start_sec, end_sec, text, words, confidence FROM segments WHERE recording_id = ? ORDER BY idx")
    .all(recordingId) as SegmentRow[];
  const segments: Segment[] = rows.map((row) => ({
    idx: row.idx,
    start: row.start_sec,
    end: row.end_sec,
    text: row.text,
    confidence: row.confidence,
    words: row.words ? (JSON.parse(row.words) as [number, number, string, number][]).map(([start, end, text, p]) => ({ start, end, text, p })) : null,
  }));
  db.close();
  save(name, { source: `${recording.original_name}, as transcribed in the archive`, duration: recording.duration, peaks: recording.peaks, segments });
}

const args = process.argv.slice(2);
if (args[0] === "--archive") {
  const [, dataDir, recordingId, name] = args;
  if (!dataDir || !recordingId || !name) throw new Error("Usage: --archive <data dir> <recording id> <fixture name>");
  fromArchive(dataDir, recordingId, name);
} else {
  const manifest = fs.readFileSync(path.join(root, "manifest.tsv"), "utf8").trim().split("\n");
  for (const line of manifest) {
    const [file, voice, rate] = line.split("\t");
    await synthesize(file, voice, rate);
  }
}
