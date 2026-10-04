import "server-only";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const readOnly = process.env.COFRE_READ_ONLY === "1" || process.env.VERCEL === "1";
const snapshotDir = path.resolve(root, process.env.COFRE_SNAPSHOT_DIR ?? "demo/archive");

function withScheme(host: string): string {
  return /^https?:\/\//.test(host) ? host.replace(/\/$/, "") : `http://${host.replace(/\/$/, "")}`;
}

function workingCopy(): string {
  let stamp = 0;
  try {
    stamp = Math.round(fs.statSync(path.join(snapshotDir, "cofre.db")).mtimeMs);
  } catch {}
  return path.join(os.tmpdir(), `thread-archive-${stamp}`);
}

export const config = {
  readOnly,
  snapshotDir,
  repository: "https://github.com/maricastroc/thread",
  dataDir: readOnly ? workingCopy() : path.resolve(root, process.env.COFRE_DATA_DIR ?? "data"),
  ollamaHost: withScheme(process.env.OLLAMA_HOST ?? "127.0.0.1:11434"),
  interpreterModel: process.env.COFRE_INTERPRETER_MODEL ?? "gemma4:e4b",
  embeddingModel: process.env.COFRE_EMBEDDING_MODEL ?? "embeddinggemma",
  whisperBin: process.env.COFRE_WHISPER_BIN ?? "whisper-cli",
  whisperModel: path.resolve(root, process.env.COFRE_WHISPER_MODEL ?? "models/ggml-large-v3-turbo-q8_0.bin"),
  vadModel: path.resolve(root, process.env.COFRE_VAD_MODEL ?? "models/ggml-silero-v6.2.0.bin"),
  ffmpegBin: process.env.COFRE_FFMPEG_BIN ?? "ffmpeg",
  whisperThreads: Number(process.env.COFRE_WHISPER_THREADS ?? 4),
};
