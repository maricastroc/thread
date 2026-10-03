import "server-only";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config";
import { run } from "./bin";
import { normalize } from "./text";
import type { Segment, Word } from "@/lib/types";

type WhisperToken = {
  text: string;
  offsets?: { from: number; to: number };
  p?: number;
  t_dtw?: number;
};

type WhisperSegment = {
  offsets: { from: number; to: number };
  text: string;
  tokens?: WhisperToken[];
};

type WhisperJson = {
  result?: { language?: string };
  transcription: WhisperSegment[];
};

export type Transcript = { language: string | null; segments: Segment[] };

export type TranscribeOptions = {
  language: string;
  prompt?: string;
  onLine?: (line: { start: number; end: number; text: string }) => void;
  onProgress?: (fraction: number) => void;
};

const linePattern = /^\[(\d+):(\d+):(\d+(?:\.\d+)?) --> (\d+):(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/;
const progressPattern = /progress\s*=\s*(\d+)%/;

const hallucinations = [
  "legendas pela comunidade amara org",
  "legenda pela comunidade amara org",
  "subtitles by the amara org community",
  "obrigado por assistir",
  "obrigada por assistir",
  "inscreva se no canal",
  "thank you for watching",
  "thanks for watching",
  "gracias por ver",
  "transcricao e legendas",
  "musica",
  "aplausos",
];

function seconds(h: string, m: string, s: string): number {
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

function decodeBytes(value: string): string {
  if (/[^\u0000-ÿ]/.test(value)) return value;
  return Buffer.from(value, "latin1").toString("utf8");
}

function isSpecial(token: WhisperToken): boolean {
  return token.text.startsWith("[_") || token.text.startsWith("<|");
}

function wordsFrom(allTokens: WhisperToken[], segmentFrom: number, segmentTo: number): Word[] {
  const tokens = allTokens.filter((t) => !isSpecial(t) && t.offsets);
  if (!tokens.length) return [];
  const vadStart = tokens[0].offsets!.from;
  const vadEnd = tokens[tokens.length - 1].offsets!.to;
  const scale = vadEnd > vadStart ? (segmentTo - segmentFrom) / (vadEnd - vadStart) : 1;
  const toTimeline = (ms: number) =>
    Math.min(segmentTo, Math.max(segmentFrom, segmentFrom + (ms - vadStart) * scale)) / 1000;

  const words: Word[] = [];
  let bytes: Buffer[] = [];
  let start = 0;
  let end = 0;
  let probs: number[] = [];

  const flush = () => {
    if (!bytes.length) return;
    const text = Buffer.concat(bytes).toString("utf8").trim();
    if (text) {
      const p = probs.length ? probs.reduce((a, b) => a + b, 0) / probs.length : 1;
      words.push({ start, end, text, p: Math.round(p * 1000) / 1000 });
    }
    bytes = [];
    probs = [];
  };

  for (const token of tokens) {
    const raw = Buffer.from(token.text, /[^\u0000-ÿ]/.test(token.text) ? "utf8" : "latin1");
    const startsWord = raw.length > 0 && raw[0] === 0x20;
    if (startsWord) flush();
    if (!bytes.length) start = toTimeline(token.offsets!.from);
    bytes.push(raw);
    end = toTimeline(token.offsets!.to);
    if (typeof token.p === "number") probs.push(token.p);
  }
  flush();
  return words;
}

function isHallucination(text: string): boolean {
  const n = normalize(text);
  if (!n) return true;
  return hallucinations.some((h) => n === h || (n.includes(h) && n.length < h.length + 12));
}

const SENTENCE_END = /[.!?…]["”»)]?$/;
const PAUSE_SECONDS = 1.2;
const MAX_WORDS = 45;

function joinWords(words: Word[]): Segment {
  const probs = words.map((w) => w.p);
  return {
    idx: 0,
    start: words[0].start,
    end: words[words.length - 1].end,
    text: words.map((w) => w.text).join(" "),
    words,
    confidence: Math.round((probs.reduce((a, b) => a + b, 0) / probs.length) * 1000) / 1000,
  };
}

export function toSentences(raw: Segment[]): Segment[] {
  const out: Segment[] = [];
  let current: Word[] = [];
  const flush = () => {
    if (current.length) out.push(joinWords(current));
    current = [];
  };
  for (const segment of raw) {
    if (!segment.words?.length) {
      flush();
      out.push(segment);
      continue;
    }
    segment.words.forEach((word, i) => {
      const previous = current[current.length - 1];
      if (previous && word.start - previous.end > PAUSE_SECONDS) flush();
      current.push(word);
      const next = segment.words![i + 1];
      const endsSentence = SENTENCE_END.test(word.text) && (!next || /^[\p{Lu}¿¡"“]/u.test(next.text) || next.start - word.end > 0.6);
      if (endsSentence || current.length >= MAX_WORDS) flush();
    });
  }
  flush();
  return out.filter((s) => !isHallucination(s.text)).map((s, idx) => ({ ...s, idx }));
}

export function buildPrompt(names: string[]): string | undefined {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))].slice(0, 40);
  return unique.length ? `${unique.join(", ")}.` : undefined;
}

export async function transcribe(dir: string, options: TranscribeOptions): Promise<Transcript> {
  const wav = path.join(dir, "speech.wav");
  const outBase = path.join(dir, "whisper");
  const args = [
    "-m",
    config.whisperModel,
    "-f",
    wav,
    "-l",
    options.language || "auto",
    "-ojf",
    "-of",
    outBase,
    "-pp",
    "-t",
    String(config.whisperThreads),
  ];
  if (fs.existsSync(config.vadModel)) args.push("--vad", "-vm", config.vadModel);
  if (options.prompt) args.push("--prompt", options.prompt);

  await run(config.whisperBin, args, {
    onStdoutLine(line) {
      const match = linePattern.exec(line.trim());
      if (!match) return;
      const text = match[7].trim();
      if (!text || isHallucination(text)) return;
      options.onLine?.({
        start: seconds(match[1], match[2], match[3]),
        end: seconds(match[4], match[5], match[6]),
        text,
      });
    },
    onStderrLine(line) {
      const match = progressPattern.exec(line);
      if (match) options.onProgress?.(Number(match[1]) / 100);
    },
  });

  const raw = await fs.promises.readFile(`${outBase}.json`);
  const json = JSON.parse(raw.toString("latin1")) as WhisperJson;
  const segments: Segment[] = [];
  for (const item of json.transcription ?? []) {
    const text = decodeBytes(item.text).replace(/\s+/g, " ").trim();
    if (!text || isHallucination(text)) continue;
    const words = item.tokens ? wordsFrom(item.tokens, item.offsets.from, item.offsets.to) : [];
    const probs = words.map((w) => w.p);
    segments.push({
      idx: segments.length,
      start: item.offsets.from / 1000,
      end: item.offsets.to / 1000,
      text,
      words: words.length ? words : null,
      confidence: probs.length ? Math.round((probs.reduce((a, b) => a + b, 0) / probs.length) * 1000) / 1000 : null,
    });
  }
  return { language: json.result?.language ?? null, segments: toSentences(segments) };
}
