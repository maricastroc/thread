import "server-only";
import type { Moment, StorySummary } from "@/lib/types";
import { db } from "./db";
import { embedQuery, searchVersion } from "./indexer";
import { getSegments, listStories } from "./repo";
import { normalize, tokens } from "./text";

type CachedChunk = {
  id: number;
  recordingId: string;
  storyId: string | null;
  segStart: number;
  segEnd: number;
  start: number;
  end: number;
  text: string;
  norm: string;
  vector: Float32Array | null;
  language: string | null;
};

const cacheHolder = globalThis as unknown as { __cofreChunks?: { version: number; chunks: CachedChunk[] } };

const stopwords = new Set(
  (
    "a o as os um uma uns umas de da do das dos em na no nas nos num numa por pelo pela para pra pro com sem que quando como onde qual quais quem " +
    "ela ele elas eles sua seu suas seus dela dele sobre foi era eram ser ter tinha tinham isso essa esse esta este aquela aquele aquilo mais muito " +
    "ja tambem e ou mas se me te lhe nos voces voce eu minha meu historia historias contou contava conta contar falou falava fala falar lembra lembrava " +
    "vo vovo " +
    "the an of in on at to for with about when how where what who she he her his they their them did does was were is are be been story stories tell told " +
    "talk talked talking say said from that this it its there any some remember remembered grandma grandpa"
  ).split(" "),
);

const COS_STRONG = 0.42;
const COS_WEAK = 0.3;
const COS_SPREAD = 0.09;
const MAX_RESULTS = 6;

function loadChunks(): CachedChunk[] {
  const version = searchVersion();
  const cached = cacheHolder.__cofreChunks;
  if (cached && cached.version === version) return cached.chunks;
  const rows = db()
    .prepare(
      `SELECT c.id, c.recording_id, c.story_id, c.seg_start, c.seg_end, c.start_sec, c.end_sec, c.text, c.embedding, r.language
       FROM chunks c JOIN recordings r ON r.id = c.recording_id`,
    )
    .all() as Record<string, unknown>[];
  const chunks = rows.map((r) => {
    const blob = r.embedding instanceof Uint8Array ? r.embedding : null;
    return {
      id: Number(r.id),
      recordingId: String(r.recording_id),
      storyId: r.story_id ? String(r.story_id) : null,
      segStart: Number(r.seg_start),
      segEnd: Number(r.seg_end),
      start: Number(r.start_sec),
      end: Number(r.end_sec),
      text: String(r.text),
      norm: normalize(String(r.text)),
      vector: blob ? new Float32Array(blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength)) : null,
      language: r.language ? String(r.language) : null,
    };
  });
  cacheHolder.__cofreChunks = { version, chunks };
  return chunks;
}

function dot(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) sum += a[i] * b[i];
  return sum;
}

export function searchTerms(query: string): string[] {
  return [...new Set(tokens(query).filter((t) => t.length >= 3 && !stopwords.has(t)))];
}

function coverage(norm: string, terms: string[]): number {
  if (!terms.length) return 0;
  const words = new Set(norm.split(" "));
  let hits = 0;
  for (const term of terms) {
    if (words.has(term) || [...words].some((w) => w.length >= 5 && term.length >= 5 && w.startsWith(term.slice(0, 5)))) hits++;
  }
  return hits / terms.length;
}

export type SearchOutcome = {
  strength: "strong" | "weak" | "none";
  moments: Moment[];
  semantic: boolean;
};

type Scored = { chunk: CachedChunk; rrf: number; cos: number; cover: number };

export async function search(query: string, birthYear: number | null): Promise<SearchOutcome> {
  const q = query.trim();
  const chunks = loadChunks();
  if (!q || !chunks.length) return { strength: "none", moments: [], semantic: false };

  const terms = searchTerms(q);
  const byId = new Map(chunks.map((c) => [c.id, c]));
  const scores = new Map<number, Scored>();
  const entry = (chunk: CachedChunk) => {
    let s = scores.get(chunk.id);
    if (!s) {
      s = { chunk, rrf: 0, cos: 0, cover: coverage(chunk.norm, terms) };
      scores.set(chunk.id, s);
    }
    return s;
  };

  if (terms.length) {
    const match = terms.map((t) => `"${t.replace(/"/g, "")}"*`).join(" OR ");
    try {
      const rows = db()
        .prepare("SELECT rowid AS id FROM chunks_fts WHERE chunks_fts MATCH ? ORDER BY bm25(chunks_fts) LIMIT 60")
        .all(match) as { id: number }[];
      rows.forEach((row, rank) => {
        const chunk = byId.get(Number(row.id));
        if (chunk) entry(chunk).rrf += 1 / (60 + rank);
      });
    } catch {}
  }

  let semantic = false;
  try {
    const queryVector = await embedQuery(q);
    const ranked = chunks
      .filter((c) => c.vector)
      .map((c) => ({ chunk: c, cos: dot(queryVector, c.vector!) }))
      .sort((a, b) => b.cos - a.cos)
      .slice(0, 60);
    semantic = ranked.length > 0;
    ranked.forEach(({ chunk, cos }, rank) => {
      const s = entry(chunk);
      s.cos = cos;
      s.rrf += 1 / (60 + rank);
    });
  } catch {}

  const groups = new Map<string, Scored>();
  for (const s of scores.values()) {
    const key = s.chunk.storyId ?? `${s.chunk.recordingId}:${s.chunk.segStart}`;
    const current = groups.get(key);
    if (!current || s.rrf + s.cover * 0.01 > current.rrf + current.cover * 0.01) groups.set(key, s);
  }

  const ranked = [...groups.values()].sort((a, b) => b.rrf + b.cover * 0.01 - (a.rrf + a.cover * 0.01));
  const topCos = Math.max(0, ...ranked.map((r) => r.cos));
  const lexicalStrong = ranked.some((r) => r.cover >= 0.5 && (terms.length <= 2 || r.cover >= 0.6));
  const strength: SearchOutcome["strength"] =
    topCos >= COS_STRONG || lexicalStrong ? "strong" : topCos >= COS_WEAK || ranked.some((r) => r.cover > 0) ? "weak" : "none";

  if (strength === "none") return { strength, moments: [], semantic };

  const floor = strength === "strong" ? Math.max(COS_WEAK, topCos - COS_SPREAD) : COS_WEAK - 0.06;
  const kept = ranked
    .filter((r) => r.cos >= floor || r.cover >= 0.5 || (!semantic && r.cover > 0))
    .slice(0, strength === "strong" ? MAX_RESULTS : 3);

  const stories = new Map<string, StorySummary>(listStories(birthYear).map((s) => [s.id, s]));
  const moments = kept.map((r) => toMoment(r, stories, terms));
  return { strength, moments, semantic };
}

function toMoment(scored: Scored, stories: Map<string, StorySummary>, terms: string[]): Moment {
  const { chunk } = scored;
  const story = chunk.storyId ? stories.get(chunk.storyId) ?? null : null;
  const from = story ? Math.max(chunk.segStart - 1, 0) : Math.max(chunk.segStart - 1, 0);
  const segments = getSegments(chunk.recordingId, from, chunk.segEnd + 1);
  const inChunk = segments.filter((s) => s.idx >= chunk.segStart && s.idx <= chunk.segEnd);
  let focus = inChunk[0];
  if (terms.length) {
    let best = -1;
    for (const s of inChunk) {
      const c = coverage(normalize(s.text), terms);
      if (c > best) {
        best = c;
        focus = s;
      }
    }
    if (best <= 0) focus = inChunk[0];
  }
  const storyStart = story?.start ?? 0;
  const before = segments.find((s) => s.idx === chunk.segStart - 1 && (!story || s.start >= storyStart - 0.01));
  const after = segments.find((s) => s.idx === chunk.segEnd + 1 && (!story || s.end <= story.end + 0.01));
  const words = new Set(terms);
  const highlight = inChunk
    .flatMap((s) => s.text.split(/\s+/))
    .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter((w) => {
      const n = normalize(w);
      return n.length >= 3 && [...words].some((t) => n === t || (n.length >= 5 && t.length >= 5 && n.startsWith(t.slice(0, 5))));
    });
  return {
    recordingId: chunk.recordingId,
    storyId: story?.id ?? null,
    storyTitle: story?.title ?? null,
    start: Math.max(0, focus.start - 0.4),
    end: chunk.end,
    storyEnd: story?.end ?? chunk.end,
    text: inChunk.map((s) => s.text).join(" "),
    before: before?.text ?? null,
    after: after?.text ?? null,
    language: chunk.language,
    when: story?.when ?? null,
    highlight: [...new Set(highlight)],
  };
}
