import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import type { NextRequest } from "next/server";
import { recordingDir } from "@/lib/server/db";
import { newId } from "@/lib/server/ids";
import { enqueue, ensureWorker } from "@/lib/server/pipeline";
import { getVault } from "@/lib/server/archive";
import { createRecording } from "@/lib/server/evidence";
import { markQuestionAsked } from "@/lib/server/interpretation";

const extensions: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/flac": "flac",
  "audio/amr": "amr",
  "audio/3gpp": "3gp",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

function extensionFor(mime: string, name: string | null): string {
  const fromName = name?.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase();
  if (fromName) return fromName;
  return extensions[mime.split(";")[0].trim().toLowerCase()] ?? "bin";
}

function header(request: NextRequest, name: string): string | null {
  const value = request.headers.get(name);
  if (!value) return null;
  try {
    return decodeURIComponent(value).trim() || null;
  } catch {
    return null;
  }
}

function validDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function POST(request: NextRequest) {
  if (!getVault()) return Response.json({ error: "The archive isn’t set up yet." }, { status: 409 });
  if (!request.body) return Response.json({ error: "No audio was sent." }, { status: 400 });

  const source = header(request, "x-cofre-source") === "imported" ? "imported" : "recorded";
  const name = header(request, "x-cofre-filename");
  const prompt = header(request, "x-cofre-prompt")?.slice(0, 300) ?? null;
  const recordedAt = validDate(header(request, "x-cofre-recorded-at")) ?? new Date().toISOString();
  const mime = request.headers.get("content-type") ?? "application/octet-stream";

  const id = newId();
  const dir = recordingDir(id);
  await fs.promises.mkdir(dir, { recursive: true });
  const file = `original.${extensionFor(mime, name)}`;
  const target = path.join(dir, file);

  try {
    await pipeline(Readable.fromWeb(request.body as unknown as NodeReadableStream), fs.createWriteStream(target));
  } catch {
    await fs.promises.rm(dir, { recursive: true, force: true });
    return Response.json({ error: "The upload was interrupted." }, { status: 400 });
  }

  const { size } = await fs.promises.stat(target);
  if (size < 512) {
    await fs.promises.rm(dir, { recursive: true, force: true });
    return Response.json({ error: "The recording is empty." }, { status: 400 });
  }

  createRecording({ id, source, recordedAt, originalFile: file, originalName: name, mime, prompt });
  if (prompt) markQuestionAsked(prompt);
  ensureWorker();
  enqueue(id);
  return Response.json({ id }, { status: 201 });
}
