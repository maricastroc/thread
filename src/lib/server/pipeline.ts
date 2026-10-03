import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { WorkStage } from "@/lib/types";
import { analyze, convert, files } from "./audio";
import { CommandError } from "./bin";
import { config } from "./config";
import { db, recordingDir } from "./db";
import { bumpSearchVersion, indexRecording } from "./indexer";
import { createInterpreter } from "./interpreter/gemma";
import { ModelServiceError } from "./ollama";
import { verify, type VerifiedFact } from "./provenance";
import {
  clearInterpretation,
  deleteRecordingRow,
  getRecording,
  getSegments,
  getVault,
  insertStory,
  knownEntities,
  pendingRecordingIds,
  replaceSegments,
  saveAnnotation,
  updateRecording,
  updateStoryTitle,
  type RecordingError,
} from "./repo";
import { planStories } from "./structure";
import { buildPrompt, transcribe } from "./whisper";

export type LiveLine = { start: number; end: number; text: string };

type WorkerState = {
  queue: string[];
  current: string | null;
  running: boolean;
  started: boolean;
  live: Map<string, LiveLine[]>;
};

const holder = globalThis as unknown as { __cofreWorker?: WorkerState };
holder.__cofreWorker ??= { queue: [], current: null, running: false, started: false, live: new Map() };
const state = holder.__cofreWorker;

const ORDER: WorkStage[] = ["preserving", "transcribing", "organizing", "indexing"];

class StageError extends Error {
  constructor(
    message: string,
    readonly detail: string,
  ) {
    super(message);
  }
}

export function ensureWorker(): void {
  if (state.started) return;
  state.started = true;
  for (const id of pendingRecordingIds()) enqueue(id);
}

export function enqueue(id: string): void {
  if (state.current === id || state.queue.includes(id)) return;
  state.queue.push(id);
  void drain();
}

export function liveLines(id: string): LiveLine[] {
  return state.live.get(id) ?? [];
}

export function isWaiting(id: string): boolean {
  return state.queue.includes(id) && state.current !== id;
}

export async function removeRecording(id: string): Promise<boolean> {
  const recording = getRecording(id);
  if (!recording || state.current === id) return false;
  state.queue = state.queue.filter((queued) => queued !== id);
  deleteRecordingRow(id);
  bumpSearchVersion();
  const removedDir = path.join(config.dataDir, "removed");
  await fs.promises.mkdir(removedDir, { recursive: true });
  await fs.promises.rename(recordingDir(id), path.join(removedDir, `${id}-${Date.now()}`)).catch(() => undefined);
  return true;
}

export function retry(id: string): boolean {
  const recording = getRecording(id);
  if (!recording?.failedStage) return false;
  updateRecording(id, { stage: recording.failedStage, failedStage: null, error: null, progress: 0, detail: null });
  enqueue(id);
  return true;
}

async function drain(): Promise<void> {
  if (state.running) return;
  state.running = true;
  try {
    while (state.queue.length) {
      const id = state.queue.shift()!;
      state.current = id;
      try {
        await processRecording(id);
      } finally {
        state.current = null;
      }
    }
  } finally {
    state.running = false;
  }
}

function describe(error: unknown): RecordingError {
  if (error instanceof CommandError || error instanceof ModelServiceError || error instanceof StageError) {
    return { message: error.message, detail: error.detail };
  }
  const e = error as Error;
  return { message: "Something unexpected happened.", detail: e?.stack ?? String(error) };
}

async function processRecording(id: string): Promise<void> {
  const recording = getRecording(id);
  if (!recording || recording.stage === "ready" || recording.failedStage) return;
  const timings: Record<string, number> = {};
  for (let i = ORDER.indexOf(recording.stage as WorkStage); i >= 0 && i < ORDER.length; i++) {
    const stage = ORDER[i];
    updateRecording(id, { stage, progress: 0, detail: null });
    const started = Date.now();
    try {
      await stages[stage](id);
      timings[stage] = Date.now() - started;
      console.log(`[cofre] ${id} ${stage} ${(timings[stage] / 1000).toFixed(1)}s`);
    } catch (error) {
      const described = describe(error);
      console.error(`[cofre] ${id} ${stage} failed: ${described.message}\n${described.detail}`);
      if (stage === "organizing") await fallbackIndex(id);
      state.live.delete(id);
      updateRecording(id, { failedStage: stage, error: described, detail: null });
      return;
    }
  }
  updateRecording(id, { stage: "ready", progress: 1, detail: null, models: { timings: JSON.stringify(timings) } });
}

const stages: Record<WorkStage, (id: string) => Promise<void>> = {
  async preserving(id) {
    const recording = getRecording(id)!;
    const dir = recordingDir(id);
    await convert(dir, recording.originalFile);
    const { duration, peaks } = await analyze(path.join(dir, files.speech));
    if (duration < 0.5) throw new StageError("The recording is empty.", `Duration: ${duration.toFixed(2)} s`);
    updateRecording(id, { duration, peaks, progress: 1 });
  },

  async transcribing(id) {
    const vault = getVault();
    const known = knownEntities();
    const prompt = buildPrompt([
      vault?.narrator ?? "",
      ...known.people.flatMap((p) => [p.name, ...p.aliases]),
      ...known.places.flatMap((p) => [p.name, ...p.aliases]),
    ]);
    state.live.set(id, []);
    const transcript = await transcribe(recordingDir(id), {
      language: vault?.language ?? "auto",
      prompt,
      onLine: (line) => state.live.get(id)?.push(line),
      onProgress: (fraction) => updateRecording(id, { progress: fraction }),
    });
    replaceSegments(id, transcript.segments);
    updateRecording(id, {
      language: transcript.language ?? (vault?.language && vault.language !== "auto" ? vault.language : null),
      progress: 1,
      models: { asr: path.basename(config.whisperModel) },
    });
    state.live.delete(id);
  },

  async organizing(id) {
    const vault = getVault();
    const recording = getRecording(id)!;
    const segments = getSegments(id);
    clearInterpretation(id);
    if (!segments.length || !vault) return;
    const interpreter = createInterpreter();
    updateRecording(id, { models: { interpreter: interpreter.model } });
    const drafts = await interpreter.findStories({
      narrator: vault.narrator,
      recordedAt: recording.recordedAt,
      prompt: recording.prompt,
      language: recording.language,
      segments,
    });
    const planned = planStories(drafts, segments);
    const ids = planned.map((story, ord) => insertStory({ recordingId: id, ord, ...story }));
    const earlier: { title: string; when: string | null }[] = [];
    let previousAnchor: VerifiedFact | null = null;
    for (let i = 0; i < planned.length; i++) {
      updateRecording(id, { detail: JSON.stringify({ annotating: i + 1, total: planned.length }), progress: i / planned.length });
      const story = planned[i];
      const storySegments = segments.filter((s) => s.idx >= story.segStart && s.idx <= story.segEnd);
      const annotation = await interpreter.annotateStory({
        narrator: vault.narrator,
        birthYear: vault.birthYear,
        recordedAt: recording.recordedAt,
        language: recording.language,
        title: story.title,
        segments: storySegments,
        known: knownEntities(),
        earlier: earlier.slice(-4),
      });
      const facts = inheritPeriod(
        verify(annotation, segments, { from: story.segStart, to: story.segEnd }, vault.narrator, vault.birthYear),
        previousAnchor,
        vault.birthYear,
      );
      const title = restoreNames(story.title, facts);
      if (title !== story.title) updateStoryTitle(ids[i], title);
      const anchor = facts.find((f) => f.kind === "time" && f.yearFrom);
      earlier.push({ title, when: anchor ? anchor.value : null });
      previousAnchor = anchor && !anchor.note?.startsWith(INHERITED) ? anchor : null;
      saveAnnotation({
        storyId: ids[i],
        recordingId: id,
        facts,
        themes: annotation.themes,
        questions: annotation.questions,
        model: interpreter.model,
      });
    }
    updateRecording(id, { detail: null, progress: 1 });
  },

  async indexing(id) {
    const segments = getSegments(id);
    const stories = storiesForIndex(id);
    await indexRecording(id, segments, stories, (fraction) => updateRecording(id, { progress: fraction }));
    updateRecording(id, { models: { embedder: config.embeddingModel } });
  },
};

const INHERITED = "Told right after";

function inheritPeriod(facts: VerifiedFact[], previous: VerifiedFact | null, birthYear: number | null): VerifiedFact[] {
  if (!previous?.yearFrom || facts.some((f) => f.kind === "time" && f.yearFrom)) return facts;
  const stage = facts.find((f) => f.kind === "life_stage");
  if (stage && stage.provenance !== "inferred") return facts;
  const year = previous.yearFrom;
  const label = previous.provenance === "inferred" ? `about ${year}` : String(year);
  const result = facts.filter((f) => f.kind !== "life_stage");
  result.push({
    kind: "time",
    value: String(year),
    detail: null,
    yearFrom: year,
    yearTo: previous.yearTo ?? year,
    provenance: "inferred",
    primary: true,
    seg: null,
    evidence: null,
    start: null,
    end: null,
    note: `${INHERITED} a story from ${label}, in the same recording.`,
  });
  if (birthYear && year >= birthYear) {
    const age = year - birthYear;
    result.push({
      kind: "life_stage",
      value: age <= 12 ? "childhood" : age <= 25 ? "youth" : age <= 59 ? "adulthood" : "later_life",
      detail: null,
      yearFrom: null,
      yearTo: null,
      provenance: "inferred",
      primary: true,
      seg: null,
      evidence: null,
      start: null,
      end: null,
      note: `About ${age} years old in ${year}, counted from the year of birth.`,
    });
  } else if (stage) {
    result.push(stage);
  }
  return result;
}

function restoreNames(title: string, facts: VerifiedFact[]): string {
  let result = title;
  for (const fact of facts) {
    if ((fact.kind !== "person" && fact.kind !== "place") || !/^\p{Lu}/u.test(fact.value)) continue;
    const escaped = fact.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`(?<![\\p{L}])${escaped}(?![\\p{L}])`, "giu"), fact.value);
  }
  return result;
}

function storiesForIndex(id: string) {
  return (
    db().prepare("SELECT id, title, seg_start, seg_end FROM stories WHERE recording_id = ? ORDER BY ord").all(id) as Record<
      string,
      unknown
    >[]
  ).map((r) => ({ id: String(r.id), title: String(r.title), segStart: Number(r.seg_start), segEnd: Number(r.seg_end) }));
}

async function fallbackIndex(id: string): Promise<void> {
  try {
    await indexRecording(id, getSegments(id), storiesForIndex(id));
  } catch {}
}
