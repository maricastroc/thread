import path from "node:path";
import { files } from "@/lib/server/audio";
import { recordingDir } from "@/lib/server/db";
import { serveFile } from "@/lib/server/serve-file";

export async function GET(request: Request, context: RouteContext<"/api/recordings/[id]/audio">) {
  const { id } = await context.params;
  if (!/^[0-9a-z]+$/.test(id)) return new Response("Not found", { status: 404 });
  return serveFile(request, path.join(recordingDir(id), files.playback), "audio/mp4");
}
