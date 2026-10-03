import "server-only";
import { normalize, tokens } from "./text";

export const kinship = new Set(
  (
    "mae mamae pai papai avo avos vovo vo irma irmao irmas irmaos tia tio tias tios filha filho filhas filhos neta neto netas netos " +
    "marido esposa esposo mulher sogra sogro cunhada cunhado prima primo madrinha padrinho afilhada afilhado bisavo " +
    "mother mom mum father dad grandmother grandma granny grandfather grandpa sister brother aunt uncle daughter son " +
    "granddaughter grandson husband wife cousin godmother godfather " +
    "madre mama padre papa abuela abuelo hermana hermano tia tio hija hijo nieta nieto esposo esposa cunado cunada suegra suegro madrina padrino"
  ).split(" "),
);

export const leadingWords = new Set(["o", "a", "os", "as", "seu", "sr", "sra", "dona", "dom", "the", "el", "la", "los", "las", "meu", "minha", "mr", "mrs", "ms"]);

const firstPerson = new Set(["meu", "minha", "meus", "minhas", "nosso", "nossa", "nossos", "nossas", "my", "our", "mi", "mis", "nuestro", "nuestra", "nuestros", "nuestras"]);

export function isKinshipName(name: string): boolean {
  const words = tokens(name).filter((w) => !leadingWords.has(w));
  return words.length > 0 && kinship.has(words[0]);
}

export function hasProperWord(text: string): boolean {
  return text
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, ""))
    .filter((w) => w && !leadingWords.has(normalize(w)))
    .some((w) => /^\p{Lu}/u.test(w));
}

export function properWords(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, ""))
    .filter((w) => w && /^\p{Lu}/u.test(w) && !leadingWords.has(normalize(w)))
    .map(normalize);
}

export function ownedKin(words: string[], at: number): boolean {
  for (let i = at - 1; i >= Math.max(0, at - 2); i--) {
    if (firstPerson.has(words[i])) return true;
    if (!["a", "o", "the", "la", "el"].includes(words[i])) return false;
  }
  return false;
}

export function mentionsOwnKin(text: string, word: string): boolean {
  const key = normalize(word).split(" ")[0];
  if (!key) return false;
  const words = tokens(text);
  return words.some((w, i) => w === key && ownedKin(words, i));
}
