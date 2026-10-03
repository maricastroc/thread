import path from "node:path";
import { recordingDir } from "@/lib/server/db";
import { getRecording } from "@/lib/server/evidence";
import { serveFile } from "@/lib/server/serve-file";

const types: Record<string, string> = {
  webm: "audio/webm",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  aac: "audio/aac",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  flac: "audio/flac",
};

export async function GET(request: Request, context: RouteContext<"/api/recordings/[id]/original">) {
  const { id } = await context.params;
  const recording = getRecording(id);
  if (!recording) return new Response("Not found", { status: 404 });
  const ext = recording.originalFile.split(".").pop()?.toLowerCase() ?? "bin";
  const filename = `recording-${recording.recordedAt.slice(0, 10)}-${id}.${ext}`;
  return serveFile(request, path.join(recordingDir(id), recording.originalFile), types[ext] ?? "application/octet-stream", {
    "Content-Disposition": `attachment; filename="${filename}"`,
  });
}
