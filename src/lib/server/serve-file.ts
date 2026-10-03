import "server-only";
import fs from "node:fs";
import { Readable } from "node:stream";

function stream(path: string, start?: number, end?: number): ReadableStream {
  return Readable.toWeb(fs.createReadStream(path, { start, end })) as ReadableStream;
}

export async function serveFile(request: Request, path: string, contentType: string, extraHeaders: Record<string, string> = {}) {
  let size: number;
  try {
    size = (await fs.promises.stat(path)).size;
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const base = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    ...extraHeaders,
  };

  const range = request.headers.get("range");
  const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
  if (!match) {
    return new Response(stream(path), { status: 200, headers: { ...base, "Content-Length": String(size) } });
  }

  let start: number;
  let end: number;
  if (match[1] === "" && match[2] !== "") {
    const suffix = Number(match[2]);
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1] || 0);
    end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  }

  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { ...base, "Content-Range": `bytes */${size}` } });
  }

  return new Response(stream(path, start, end), {
    status: 206,
    headers: {
      ...base,
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": String(end - start + 1),
    },
  });
}
