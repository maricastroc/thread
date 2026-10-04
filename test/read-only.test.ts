import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

const dir = mkdtempSync(path.join(tmpdir(), "thread-read-only-"));
process.env.TMPDIR = dir;
process.env.COFRE_READ_ONLY = "1";
after(() => rmSync(dir, { recursive: true, force: true }));

const snapshotDb = path.resolve("demo/archive/cofre.db");
const fingerprint = () => createHash("sha256").update(readFileSync(snapshotDb)).digest("hex");
const before = fingerprint();

test("a read-only archive is read from a working copy of the snapshot, and the snapshot is never written", async () => {
  const { config } = await import("../src/lib/server/config");
  const { getVault } = await import("../src/lib/server/archive");
  const { listRecordings } = await import("../src/lib/server/evidence");
  assert.equal(config.readOnly, true);
  assert.ok(config.dataDir.startsWith(dir));
  assert.ok(getVault());
  assert.ok(listRecordings().length > 0);
  assert.equal(fingerprint(), before);
});

test("every change is refused in a read-only archive", async () => {
  const { listRecordings } = await import("../src/lib/server/evidence");
  const { listStories } = await import("../src/lib/server/interpretation");
  const id = listRecordings()[0].id;
  const params = { params: Promise.resolve({ id }) };
  const upload = await import("../src/app/api/recordings/route");
  const recording = await import("../src/app/api/recordings/[id]/route");
  const reprocess = await import("../src/app/api/recordings/[id]/reprocess/route");
  const retry = await import("../src/app/api/recordings/[id]/retry/route");
  const vault = await import("../src/app/api/vault/route");
  const responses = [
    await upload.POST(new Request("http://localhost/api/recordings", { method: "POST", body: "audio" }) as never),
    await recording.DELETE(new Request(`http://localhost/api/recordings/${id}`, { method: "DELETE" }) as never, params as never),
    await reprocess.POST(new Request(`http://localhost/api/recordings/${id}/reprocess`, { method: "POST", body: "{}" }), params as never),
    await retry.POST(new Request(`http://localhost/api/recordings/${id}/retry`, { method: "POST" }), params as never),
    await vault.POST(new Request("http://localhost/api/vault", { method: "POST", body: JSON.stringify({ subject: "Someone else" }) })),
  ];
  assert.deepEqual(
    responses.map((r) => r.status),
    [403, 403, 403, 403, 403],
  );
  assert.ok(listRecordings().some((r) => r.id === id));
  assert.ok(listStories(null).length > 0);
  assert.equal(fingerprint(), before);
});
