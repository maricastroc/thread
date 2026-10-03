import "server-only";
import { tokens } from "./text";

const units: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezasseis: 16,
  dezessete: 17, dezassete: 17, dezoito: 18, dezenove: 19, dezanove: 19,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11,
  twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  un: 1, uno: 1, dos: 2, cuatro: 4, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14,
  quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veintiuno: 21, veintiun: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26,
  veintisiete: 27, veintiocho: 28, veintinueve: 29,
};

const tens: Record<string, number> = {
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, cincoenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, ochenta: 80,
};

const durationWords = new Set(["ano", "anos", "year", "years", "anitos", "meses", "mes", "months", "dias", "days"]);
const connectors = new Set(["e", "y", "and"]);

type Found = { value: number; next: string | undefined; at: number };

function readNumbers(words: string[]): Found[] {
  const found: Found[] = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (/^\d{1,4}$/.test(word)) {
      found.push({ value: Number(word), next: words[i + 1], at: i });
      continue;
    }
    if (word in tens) {
      let value = tens[word];
      let j = i + 1;
      if (connectors.has(words[j]) && words[j + 1] in units && units[words[j + 1]] < 10) {
        value += units[words[j + 1]];
        j += 2;
      } else if (words[j] in units && units[words[j]] < 10) {
        value += units[words[j]];
        j += 1;
      }
      found.push({ value, next: words[j], at: i });
      i = j - 1;
      continue;
    }
    if (word in units) found.push({ value: units[word], next: words[i + 1], at: i });
  }
  return found;
}

export function statesYear(evidence: string, year: number): boolean {
  const words = tokens(evidence);
  for (const { value, next } of readNumbers(words)) {
    if (next && durationWords.has(next)) continue;
    if (value === year) return true;
    if (value < 100 && value === year % 100) return true;
  }
  return false;
}

const approximateMarkers = [
  "por volta de", "por volta", "la pelos", "la pelo", "la por", "mais ou menos", "perto de", "cerca de", "aproximadamente",
  "around", "about", "circa", "roughly", "approximately", "alrededor de", "hacia", "mas o menos",
].map((m) => m.split(" "));
const linking = new Set(["de", "em", "in", "o", "del", "el", "ano", "year", "the", "do", "dos", "anos"]);

export function isApproximate(text: string, year: number): boolean {
  const words = tokens(text);
  for (const { value, at } of readNumbers(words)) {
    if (value !== year && !(value < 100 && value === year % 100)) continue;
    let end = at;
    while (end > 0 && linking.has(words[end - 1])) end--;
    if (approximateMarkers.some((marker) => marker.length <= end && marker.every((w, k) => words[end - marker.length + k] === w))) return true;
  }
  return false;
}

export function parseNumber(phrase: string): number | null {
  const words = tokens(phrase);
  const found = readNumbers(words);
  return found.length ? found[0].value : null;
}

const N = String.raw`(\d{1,3}|\p{L}+(?:-\p{L}+)?(?:\s+(?:e|y|and)\s+\p{L}+)?)`;
const YEARS_PT = String.raw`anos?`;
const YEARS_ES = String.raw`a[ñn]os?`;
const YEARS_EN = String.raw`years?`;
const re = (source: string) => new RegExp(source, "giu");

const firstPersonAgePatterns = [
  re(String.raw`\beu\s+(?:j[aá]\s+|ainda\s+|s[oó]\s+)?(?:tinha|tava\s+com|estava\s+com|devia\s+ter|deveria\s+ter|teria|fiz|completei|ia\s+fazer|ia\s+completar)\s+(?:uns\s+|umas\s+|quase\s+|mais\s+ou\s+menos\s+|s[oó]\s+|apenas\s+)?${N}\s+${YEARS_PT}\b`),
  re(String.raw`\b(?:com|aos)\s+${N}\s+${YEARS_PT}(?:\s+de\s+idade)?,?\s+eu\b`),
  re(String.raw`\byo\s+(?:ya\s+)?(?:ten[ií]a|tendr[ií]a|cumpl[ií]|hab[ií]a\s+cumplido|iba\s+a\s+cumplir)\s+(?:unos\s+|casi\s+|apenas\s+)?${N}\s+${YEARS_ES}\b`),
  re(String.raw`\b(?:con|a\s+los)\s+${N}\s+${YEARS_ES},?\s+yo\b`),
  re(String.raw`\bI\s+was\s+(?:about\s+|around\s+|nearly\s+|almost\s+|only\s+|just\s+)?${N}(?:\s+${YEARS_EN}\s+old)?(?=\s*(?:[,.;:!?]|$)|\s+(?:when|and|at\s+the\s+time|then)\b)`),
  re(String.raw`\bI\s+(?:had\s+)?(?:just\s+)?turned\s+${N}\b`),
  re(String.raw`\b(?:at|by)\s+the\s+age\s+of\s+${N},?\s+I\b`),
];

const otherAgePatterns = [
  re(String.raw`\b(?:tinha|tem|teria|tava\s+com|estava\s+com|est[aá]\s+com|devia\s+ter|fez|faz|completou|morreu\s+com|faleceu\s+com|com|aos)\s+(?:uns\s+|umas\s+|quase\s+|mais\s+ou\s+menos\s+|s[oó]\s+)?${N}\s+${YEARS_PT}(?!\s+de\s+(?!idade))\b`),
  re(String.raw`\b(?:ten[ií]a|tiene|tendr[ií]a|cumpli[oó]|muri[oó]\s+con|con|a\s+los)\s+(?:unos\s+|casi\s+)?${N}\s+${YEARS_ES}(?!\s+de\s+(?!edad))\b`),
  re(String.raw`\b${N}[\s-]+${YEARS_EN}[\s-]+old\b`),
];

export type AgeFind = { age: number; phrase: string; index: number; firstPerson: boolean };

function collect(patterns: RegExp[], text: string): { value: number; phrase: string; index: number }[] {
  const found: { value: number; phrase: string; index: number }[] = [];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const value = parseNumber(match[1].replace(/-/g, " "));
      if (value === null || value <= 0 || value >= 110) continue;
      found.push({ value, phrase: match[0].trim(), index: match.index ?? 0 });
    }
  }
  return found.sort((a, b) => a.index - b.index);
}

const overlaps = (a: { index: number; phrase: string }, b: { index: number; phrase: string }) =>
  a.index < b.index + b.phrase.length && b.index < a.index + a.phrase.length;

export function findAges(text: string): AgeFind[] {
  const first = collect(firstPersonAgePatterns, text).map((f) => ({ age: f.value, phrase: f.phrase, index: f.index, firstPerson: true }));
  const others = collect(otherAgePatterns, text)
    .filter((f) => !first.some((n) => overlaps(n, f)))
    .map((f) => ({ age: f.value, phrase: f.phrase, index: f.index, firstPerson: false }));
  const result: AgeFind[] = [];
  for (const found of [...first, ...others].sort((a, b) => a.index - b.index)) {
    if (!result.some((r) => overlaps(r, found))) result.push(found);
  }
  return result;
}

export function findFirstPersonAge(text: string): { age: number; phrase: string } | null {
  const found = findAges(text).find((f) => f.firstPerson);
  return found ? { age: found.age, phrase: found.phrase } : null;
}

export type SpanFind = { value: number; phrase: string; index: number };

const offsetPatterns: [RegExp, number | null][] = [
  [re(String.raw`\b${N}\s+${YEARS_PT}\s+(?:depois|mais\s+tarde|ap[oó]s)\b`), null],
  [re(String.raw`\bdepois\s+de\s+${N}\s+${YEARS_PT}\b`), null],
  [re(String.raw`\b${N}\s+${YEARS_ES}\s+(?:despu[eé]s|m[aá]s\s+tarde)\b`), null],
  [re(String.raw`\bdespu[eé]s\s+de\s+${N}\s+${YEARS_ES}\b`), null],
  [re(String.raw`\b${N}\s+${YEARS_EN}\s+later\b`), null],
  [re(String.raw`\bafter\s+${N}\s+${YEARS_EN}\b`), null],
  [re(String.raw`\b(?:no|o|do)\s+ano\s+seguinte\b`), 1],
  [re(String.raw`\bal\s+a[ñn]o\s+siguiente\b`), 1],
  [re(String.raw`\b(?:the\s+)?(?:next|following)\s+year\b`), 1],
  [re(String.raw`\ba\s+year\s+later\b`), 1],
];

const durationPatterns = [
  re(String.raw`\b(?:por|durante)\s+${N}\s+(?:${YEARS_PT}|${YEARS_ES})\b`),
  re(String.raw`\b(?:trabalhou|trabalhei|morou|morei|viveu|vivi|ficou|fiquei|passou|passei|esteve|estive)\s+(?:uns\s+|quase\s+)?${N}\s+${YEARS_PT}\b`),
  re(String.raw`\b${N}\s+${YEARS_PT}\s+(?!quando\b)\p{L}{2,}(?:ando|endo|indo|ondo)\b`),
  re(String.raw`\bdesde\s+hac[ií]a\s+${N}\s+${YEARS_ES}\b`),
  re(String.raw`\b(?:trabaj[oó]|trabaj[eé]|vivi[oó]|viv[ií]|pas[oó]|pas[eé]|estuvo|estuve)\s+${N}\s+${YEARS_ES}\b`),
  re(String.raw`\b${N}\s+${YEARS_ES}\s+\p{L}{2,}(?:ando|iendo|yendo)\b`),
  re(String.raw`\bfor\s+${N}\s+${YEARS_EN}\b`),
];

export function findOffsets(text: string): SpanFind[] {
  const found: SpanFind[] = [];
  for (const [pattern, fixed] of offsetPatterns) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const value = fixed ?? parseNumber(match[1].replace(/-/g, " "));
      if (value === null || value <= 0 || value >= 100) continue;
      const item = { value, phrase: match[0].trim(), index: match.index ?? 0 };
      if (!found.some((f) => overlaps(f, item))) found.push(item);
    }
  }
  return found.sort((a, b) => a.index - b.index);
}

export function findDurations(text: string): SpanFind[] {
  const ages = findAges(text);
  const found: SpanFind[] = [];
  for (const item of collect(durationPatterns, text)) {
    const span = { value: item.value, phrase: item.phrase, index: item.index };
    if (span.value >= 100 || ages.some((a) => overlaps(a, span)) || found.some((f) => overlaps(f, span))) continue;
    found.push(span);
  }
  return found;
}
