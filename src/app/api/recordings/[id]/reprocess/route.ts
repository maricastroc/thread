import type { WorkStage } from "@/lib/types";
import { enqueue, ensureWorker } from "@/lib/server/pipeline";
import { getRecording, updateRecording } from "@/lib/server/evidence";
import { readOnlyRefusal } from "@/lib/server/read-only";

const allowed: WorkStage[] = ["transcribing", "organizing", "indexing"];

export async function POST(request: Request, context: RouteContext<"/api/recordings/[id]/reprocess">) {
  const refused = readOnlyRefusal();
  if (refused) return refused;
  const { id } = await context.params;
  const recording = getRecording(id);
  if (!recording) return Response.json({ error: "Not found" }, { status: 404 });
  if (recording.stage !== "ready" && !recording.failedStage) return Response.json({ error: "Still processing." }, { status: 409 });
  const body = (await request.json().catch(() => ({}))) as { from?: string };
  const from = allowed.find((s) => s === body.from) ?? "organizing";
  ensureWorker();
  updateRecording(id, { stage: from, failedStage: null, error: null, progress: 0, detail: null });
  enqueue(id);
  return Response.json({ ok: true, from });
}
