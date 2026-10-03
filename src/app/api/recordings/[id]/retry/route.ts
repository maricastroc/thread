import { ensureWorker, retry } from "@/lib/server/pipeline";

export async function POST(_request: Request, context: RouteContext<"/api/recordings/[id]/retry">) {
  const { id } = await context.params;
  ensureWorker();
  return retry(id) ? Response.json({ ok: true }) : Response.json({ error: "Nothing to retry." }, { status: 409 });
}
