import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, test } from "node:test";

const dir = mkdtempSync(path.join(tmpdir(), "thread-cold-"));
process.env.TMPDIR = dir;
process.env.COFRE_READ_ONLY = "1";
after(() => rmSync(dir, { recursive: true, force: true }));

test("a fresh read-only server plays a recording even when nothing has opened the archive yet", async () => {
  const snapshot = new DatabaseSync(path.resolve("demo/archive/cofre.db"), { readOnly: true });
  const { id } = snapshot.prepare("SELECT id FROM recordings LIMIT 1").get() as { id: string };
  snapshot.close();
  const audio = await import("../src/app/api/recordings/[id]/audio/route");
  const response = await audio.GET(new Request(`http://localhost/api/recordings/${id}/audio`, { headers: { range: "bytes=0-1023" } }), {
    params: Promise.resolve({ id }),
  } as never);
  assert.equal(response.status, 206);
  await response.body?.cancel();
});
