import "server-only";
import { tokens } from "./text";

const units: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezasseis: 16,
  dezessete: 17, dezassete: 17, dezoito: 18, dezenove: 19, dezanove: 19,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11,
  twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  uno: 1, cuatro: 4, siete: 7, ocho: 8, nueve: 9, diez: 10, trece: 13, catorce: 14,
};

const tens: Record<string, number> = {
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, cincoenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  veinte: 20, treinta: 30, cuarenta: 40, sesenta: 60, ochenta: 80,
};

const durationWords = new Set(["ano", "anos", "year", "years", "anitos", "meses", "mes", "months", "dias", "days"]);
const connectors = new Set(["e", "y", "and"]);

type Found = { value: number; next: string | undefined };

function readNumbers(words: string[]): Found[] {
  const found: Found[] = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (/^\d{1,4}$/.test(word)) {
      found.push({ value: Number(word), next: words[i + 1] });
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
      found.push({ value, next: words[j] });
      i = j - 1;
      continue;
    }
    if (word in units) found.push({ value: units[word], next: words[i + 1] });
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

export function parseNumber(phrase: string): number | null {
  const words = tokens(phrase);
  const found = readNumbers(words);
  return found.length ? found[0].value : null;
}

const agePatterns = [
  /\b(?:eu\s+)?(?:tinha|devia\s+ter|tava\s+com|estava\s+com)\s+(?:uns|umas|quase|mais ou menos)?\s*((?:\d{1,2})|(?:[\p{L}]+(?:\s+e\s+[\p{L}]+)?))\s+anos\b/iu,
  /\b(?:com|aos)\s+((?:\d{1,2})|(?:[\p{L}]+(?:\s+e\s+[\p{L}]+)?))\s+anos\b/iu,
  /\b((?:\d{1,2})|(?:[\p{L}]+(?:\s+e\s+[\p{L}]+)?))\s+anos\s+de\s+idade\b/iu,
  /\btenía\s+((?:\d{1,2})|(?:[\p{L}]+(?:\s+y\s+[\p{L}]+)?))\s+años\b/iu,
  /\bI\s+was\s+(?:about\s+|around\s+)?((?:\d{1,2})|(?:[a-z]+(?:-[a-z]+)?))\s+years?\s+old\b/iu,
];

export function findAge(text: string): { age: number; phrase: string } | null {
  for (const pattern of agePatterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const age = parseNumber(match[1].replace(/-/g, " "));
    if (age !== null && age > 0 && age < 110) return { age, phrase: match[0] };
  }
  return null;
}
