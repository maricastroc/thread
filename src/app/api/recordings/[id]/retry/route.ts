import { ensureWorker, retry } from "@/lib/server/pipeline";
import { readOnlyRefusal } from "@/lib/server/read-only";

export async function POST(_request: Request, context: RouteContext<"/api/recordings/[id]/retry">) {
  const refused = readOnlyRefusal();
  if (refused) return refused;
  const { id } = await context.params;
  ensureWorker();
  return retry(id) ? Response.json({ ok: true }) : Response.json({ error: "Nothing to retry." }, { status: 409 });
}
