import "server-only";
import path from "node:path";

const root = process.cwd();

function withScheme(host: string): string {
  return /^https?:\/\//.test(host) ? host.replace(/\/$/, "") : `http://${host.replace(/\/$/, "")}`;
}

export const config = {
  dataDir: path.resolve(root, process.env.COFRE_DATA_DIR ?? "data"),
  ollamaHost: withScheme(process.env.OLLAMA_HOST ?? "127.0.0.1:11434"),
  interpreterModel: process.env.COFRE_INTERPRETER_MODEL ?? "gemma4:e4b",
  embeddingModel: process.env.COFRE_EMBEDDING_MODEL ?? "embeddinggemma",
  whisperBin: process.env.COFRE_WHISPER_BIN ?? "whisper-cli",
  whisperModel: path.resolve(root, process.env.COFRE_WHISPER_MODEL ?? "models/ggml-large-v3-turbo-q8_0.bin"),
  vadModel: path.resolve(root, process.env.COFRE_VAD_MODEL ?? "models/ggml-silero-v6.2.0.bin"),
  ffmpegBin: process.env.COFRE_FFMPEG_BIN ?? "ffmpeg",
  whisperThreads: Number(process.env.COFRE_WHISPER_THREADS ?? 4),
};
