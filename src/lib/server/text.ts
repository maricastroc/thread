import "server-only";
import type { Segment } from "@/lib/types";

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function tokens(text: string): string[] {
  const n = normalize(text);
  return n ? n.split(" ") : [];
}

type Located = { start: number; end: number; evidence: string };

function sameToken(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length >= 5 && b.length >= 5) {
    const short = a.length < b.length ? a : b;
    const long = a.length < b.length ? b : a;
    return long.startsWith(short.slice(0, Math.max(5, short.length - 1)));
  }
  return false;
}

function findRun(haystack: string[], needle: string[]): [number, number] | null {
  if (!needle.length || needle.length > haystack.length) return null;
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (!sameToken(haystack[i + j], needle[j])) continue outer;
    }
    return [i, i + needle.length - 1];
  }
  if (needle.length >= 3) {
    const window = needle.length + 2;
    for (let i = 0; i < haystack.length; i++) {
      const slice = haystack.slice(i, i + window);
      let k = 0;
      let first = -1;
      let last = -1;
      for (let j = 0; j < slice.length && k < needle.length; j++) {
        if (sameToken(slice[j], needle[k])) {
          if (first < 0) first = i + j;
          last = i + j;
          k++;
        }
      }
      if (k === needle.length) return [first, last];
    }
  }
  return null;
}

function exactRun(haystack: string[], needle: string[]): [number, number] | null {
  if (!needle.length || needle.length > haystack.length) return null;
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return [i, i + needle.length - 1];
  }
  return null;
}

export function containsPhrase(text: string, phrase: string): boolean {
  return findRun(tokens(text), tokens(phrase)) !== null;
}

export function saysPhrase(text: string, phrase: string): boolean {
  return exactRun(tokens(text), tokens(phrase)) !== null;
}

const SENTENCE_END = /[.!?…]["”»)]?$/;

export function saidWords(text: string, phrase: string): { word: string; opensSentence: boolean }[] | null {
  const raw = text.split(/\s+/).filter(Boolean);
  const flat: string[] = [];
  const owner: number[] = [];
  raw.forEach((piece, wi) => {
    for (const tok of tokens(piece)) {
      flat.push(tok);
      owner.push(wi);
    }
  });
  const run = exactRun(flat, tokens(phrase));
  if (!run) return null;
  const words = [];
  for (let wi = owner[run[0]]; wi <= owner[run[1]]; wi++) {
    words.push({ word: raw[wi].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""), opensSentence: wi === 0 || SENTENCE_END.test(raw[wi - 1]) });
  }
  return words;
}

export function locateInSegment(segment: Segment, mention: string): Located | null {
  return locate(segment, mention, findRun);
}

export function locateSaid(segment: Segment, mention: string): Located | null {
  return locate(segment, mention, exactRun);
}

function locate(segment: Segment, mention: string, match: (haystack: string[], needle: string[]) => [number, number] | null): Located | null {
  const needle = tokens(mention);
  if (!needle.length) return null;

  if (segment.words?.length) {
    const flat: string[] = [];
    const owner: number[] = [];
    segment.words.forEach((word, wi) => {
      for (const tok of tokens(word.text)) {
        flat.push(tok);
        owner.push(wi);
      }
    });
    const run = match(flat, needle);
    if (run) {
      const first = owner[run[0]];
      const last = owner[run[1]];
      const words = segment.words.slice(first, last + 1);
      return {
        start: words[0].start,
        end: words[words.length - 1].end,
        evidence: words
          .map((w) => w.text)
          .join(" ")
          .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""),
      };
    }
  }

  const raw = segment.text.split(/\s+/);
  const flat: string[] = [];
  const owner: number[] = [];
  raw.forEach((piece, wi) => {
    for (const tok of tokens(piece)) {
      flat.push(tok);
      owner.push(wi);
    }
  });
  const run = match(flat, needle);
  if (!run) return null;
  return {
    start: segment.start,
    end: segment.end,
    evidence: raw
      .slice(owner[run[0]], owner[run[1]] + 1)
      .join(" ")
      .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""),
  };
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.2);
}
