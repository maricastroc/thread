import type { NextRequest } from "next/server";
import { slicePeaks } from "@/lib/server/peaks";
import { ensureWorker, isWaiting, liveLines } from "@/lib/server/pipeline";
import { getPeaks, getRecording, getSegments, getVault, liveStories } from "@/lib/server/repo";

export async function GET(request: NextRequest, context: RouteContext<"/api/recordings/[id]">) {
  const { id } = await context.params;
  ensureWorker();
  const recording = getRecording(id);
  if (!recording) return Response.json({ error: "Not found" }, { status: 404 });
  const vault = getVault();
  const params = request.nextUrl.searchParams;
  const after = Math.max(0, Number(params.get("after") ?? 0) || 0);
  const wantPeaks = params.get("peaks") === "1";

  const live = recording.stage === "transcribing" && !recording.failedStage;
  const lines = live
    ? liveLines(id).map((l, i) => ({ idx: i, start: l.start, end: l.end, text: l.text }))
    : getSegments(id).map(({ idx, start, end, text }) => ({ idx, start, end, text }));

  let progress = recording.progress;
  if (live && recording.duration && lines.length) {
    progress = Math.max(progress, Math.min(0.99, lines[lines.length - 1].end / recording.duration));
  }

  const { originalFile: _file, ...summary } = recording;
  void _file;

  return Response.json(
    {
      ...summary,
      progress,
      waiting: isWaiting(id),
      transcript: { source: live ? "live" : "final", total: lines.length, lines: lines.slice(after) },
      stories: liveStories(id, vault?.birthYear ?? null),
      peaks: wantPeaks && recording.duration ? slicePeaks(getPeaks(id), 0, recording.duration, 1200) : null,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
