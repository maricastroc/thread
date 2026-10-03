import "server-only";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config";
import { run } from "./bin";

export const PEAKS_PER_SECOND = 20;
const SAMPLE_RATE = 16000;

export const files = {
  playback: "audio.m4a",
  speech: "speech.wav",
  whisper: "whisper",
};

export async function convert(dir: string, original: string): Promise<void> {
  await run(config.ffmpegBin, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    path.join(dir, original),
    "-map",
    "0:a:0",
    "-vn",
    "-ac",
    "1",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    path.join(dir, files.playback),
    "-map",
    "0:a:0",
    "-vn",
    "-ac",
    "1",
    "-ar",
    String(SAMPLE_RATE),
    "-c:a",
    "pcm_s16le",
    path.join(dir, files.speech),
  ]);
}

function findDataChunk(header: Buffer): { offset: number; size: number } {
  if (header.toString("ascii", 0, 4) !== "RIFF" || header.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Not a WAV file");
  }
  let offset = 12;
  while (offset + 8 <= header.length) {
    const id = header.toString("ascii", offset, offset + 4);
    const size = header.readUInt32LE(offset + 4);
    if (id === "data") return { offset: offset + 8, size };
    offset += 8 + size + (size % 2);
  }
  throw new Error("WAV data chunk not found");
}

export async function analyze(wavPath: string): Promise<{ duration: number; peaks: Uint8Array }> {
  const handle = await fs.promises.open(wavPath, "r");
  const header = Buffer.alloc(8192);
  await handle.read(header, 0, header.length, 0);
  await handle.close();
  const { offset } = findDataChunk(header);
  const fileSize = (await fs.promises.stat(wavPath)).size;
  const sampleCount = Math.floor((fileSize - offset) / 2);
  const bucket = SAMPLE_RATE / PEAKS_PER_SECOND;
  const rms = new Float32Array(Math.ceil(sampleCount / bucket));

  let index = 0;
  let sum = 0;
  let count = 0;
  let carry: Buffer | null = null;

  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(wavPath, { start: offset, highWaterMark: 1 << 20 });
    stream.on("data", (raw: string | Buffer) => {
      let chunk = typeof raw === "string" ? Buffer.from(raw) : raw;
      if (carry) {
        chunk = Buffer.concat([carry, chunk]);
        carry = null;
      }
      const usable = chunk.length - (chunk.length % 2);
      if (usable < chunk.length) carry = chunk.subarray(usable);
      for (let i = 0; i < usable; i += 2) {
        const v = chunk.readInt16LE(i) / 32768;
        sum += v * v;
        count++;
        if (count === bucket) {
          rms[index++] = Math.sqrt(sum / count);
          sum = 0;
          count = 0;
        }
      }
    });
    stream.on("end", () => {
      if (count > 0) rms[index++] = Math.sqrt(sum / count);
      resolve();
    });
    stream.on("error", reject);
  });

  const values = rms.subarray(0, index);
  const sorted = Float32Array.from(values).sort();
  const reference = sorted[Math.floor(sorted.length * 0.985)] || sorted[sorted.length - 1] || 1;
  const peaks = new Uint8Array(values.length);
  for (let i = 0; i < values.length; i++) {
    const level = Math.min(1, values[i] / (reference || 1));
    peaks[i] = Math.round(Math.sqrt(level) * 255);
  }
  return { duration: sampleCount / SAMPLE_RATE, peaks };
}
