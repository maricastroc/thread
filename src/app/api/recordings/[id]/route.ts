import type { NextRequest } from "next/server";
import { ensureWorker, removeRecording } from "@/lib/server/pipeline";
import { readOnlyRefusal } from "@/lib/server/read-only";
import { recordingStatus } from "@/lib/server/status";

export async function GET(request: NextRequest, context: RouteContext<"/api/recordings/[id]">) {
  const { id } = await context.params;
  ensureWorker();
  const params = request.nextUrl.searchParams;
  const after = Math.max(0, Number(params.get("after") ?? 0) || 0);
  const status = recordingStatus(id, after, params.get("peaks") === "1");
  if (!status) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(status, { headers: { "cache-control": "no-store" } });
}

export async function DELETE(_request: NextRequest, context: RouteContext<"/api/recordings/[id]">) {
  const refused = readOnlyRefusal();
  if (refused) return refused;
  const { id } = await context.params;
  const removed = await removeRecording(id);
  return removed ? Response.json({ ok: true }) : Response.json({ error: "Not found or still processing." }, { status: 409 });
}
