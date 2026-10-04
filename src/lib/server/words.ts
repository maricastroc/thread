import "server-only";
import type { LifeStage } from "@/lib/types";
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

const institutions = new Set(
  (
    "colegio escola grupo faculdade universidade instituto liceu ginasio seminario creche academia conservatorio " +
    "igreja capela paroquia catedral basilica convento mosteiro santuario sinagoga mesquita irmandade congregacao " +
    "hospital clinica maternidade sanatorio farmacia drogaria posto " +
    "banco fabrica usina empresa companhia firma loja mercado supermercado mercearia armazem padaria acougue bar botequim " +
    "restaurante lanchonete hotel pensao pousada oficina grafica editora livraria cooperativa cinema teatro radio jornal revista " +
    "estaleiro construtora tecelagem prefeitura assembleia ministerio secretaria tribunal forum cartorio delegacia " +
    "policia exercito marinha aeronautica quartel batalhao correios sindicato associacao clube federacao partido fundacao " +
    "orfanato asilo museu biblioteca " +
    "escuela facultad universidad liceo guarderia iglesia capilla parroquia monasterio mezquita cofradia hermandad " +
    "compania tienda almacen panaderia carniceria taberna cantina cafeteria pension hostal taller imprenta editorial libreria " +
    "cine periodico diario ayuntamiento alcaldia municipalidad gobierno juzgado comisaria ejercito armada cuartel regimiento " +
    "correos asociacion club federacion fundacion museo " +
    "school college university institute seminary nursery kindergarten church chapel cathedral parish convent monastery " +
    "priory synagogue mosque clinic infirmary sanatorium pharmacy bank factory company corporation shop store market " +
    "supermarket bakery pub tavern restaurant cafe garage bookshop brewery theatre theater newspaper shipyard colliery " +
    "council parliament ministry department government police army navy barracks union association society federation " +
    "party foundation orphanage museum library"
  ).split(" "),
);

const firstPerson = new Set(["meu", "minha", "meus", "minhas", "nosso", "nossa", "nossos", "nossas", "my", "our", "mi", "mis", "nuestro", "nuestra", "nuestros", "nuestras"]);

export function isKinshipName(name: string): boolean {
  const words = tokens(name).filter((w) => !leadingWords.has(w));
  return words.length > 0 && kinship.has(words[0]);
}

const stageNames: Record<string, LifeStage> = {
  crianca: "childhood", menina: "childhood", menino: "childhood", pequena: "childhood", pequeno: "childhood",
  pequenininha: "childhood", pequenininho: "childhood", garotinha: "childhood", garotinho: "childhood", nenem: "childhood",
  bebe: "childhood", infancia: "childhood", meninice: "childhood",
  mocinha: "youth", mocinho: "youth", moca: "youth", rapaz: "youth", rapazinho: "youth", jovem: "youth",
  adolescente: "youth", adolescencia: "youth", juventude: "youth", mocidade: "youth",
  adulta: "adulthood", adulto: "adulthood", "idade adulta": "adulthood", "mulher feita": "adulthood", "homem feito": "adulthood",
  velha: "later_life", velho: "later_life", idosa: "later_life", idoso: "later_life", velhinha: "later_life",
  velhinho: "later_life", velhice: "later_life", "terceira idade": "later_life",
  child: "childhood", kid: "childhood", baby: "childhood", toddler: "childhood", "little girl": "childhood",
  "little boy": "childhood", childhood: "childhood",
  teenager: "youth", teen: "youth", teens: "youth", "teenage years": "youth", adolescent: "youth", adolescence: "youth",
  youth: "youth", "young woman": "youth", "young man": "youth",
  adult: "adulthood", adulthood: "adulthood", "grown up": "adulthood", "grown woman": "adulthood", "grown man": "adulthood",
  elderly: "later_life", "old woman": "later_life", "old man": "later_life", "old age": "later_life",
  nina: "childhood", nino: "childhood", ninez: "childhood", chiquita: "childhood", chiquito: "childhood",
  muchacha: "youth", muchacho: "youth", jovencita: "youth", jovencito: "youth", joven: "youth", juventud: "youth",
  vieja: "later_life", viejo: "later_life", anciana: "later_life", anciano: "later_life", vejez: "later_life",
};

const STAGE = `(?<stage>${Object.keys(stageNames)
  .sort((a, b) => b.length - a.length)
  .join("|")})`;

const namedStagePatterns = [
  `\\beu (?:(?:ja|ainda|so) )?(?:era|estava|tava|fui|ficava|fiquei|virei) (?:(?:uma|um|bem|muito|ainda|ja|so) )*${STAGE}\\b`,
  `\\bminha (?<stage>infancia|meninice|adolescencia|juventude|mocidade|velhice|idade adulta)\\b`,
  `\\b(?:quando|na|no|desde a|durante a|de) (?:(?:ja|ainda) )?(?:(?:era|estava|tava|fui) )?(?:(?:uma|um|bem|muito) )*${STAGE} eu\\b`,
  `\\bi (?:was|were|became) (?:(?:still|just|already|only|a|an|very|quite) )*${STAGE}\\b(?! s\\b)`,
  `\\bmy (?<stage>childhood|youth|teens|teenage years|adolescence|adulthood|old age)\\b`,
  `\\b(?:as a|as an|when a) ${STAGE} i\\b`,
  `\\byo (?:(?:ya|todavia|aun) )?(?:era|estaba|fui) (?:(?:una|un|muy|todavia|ya) )*${STAGE}\\b`,
  `\\bmi (?<stage>infancia|ninez|adolescencia|juventud|vejez)\\b`,
  `\\b(?:cuando|de|en la) (?:(?:ya|todavia) )?(?:(?:era|estaba) )?(?:(?:una|un|muy) )*${STAGE} yo\\b`,
].map((source) => new RegExp(source, "g"));

export function findNamedStages(text: string): { value: LifeStage; phrase: string; index: number }[] {
  const plain = normalize(text);
  const found: { value: LifeStage; phrase: string; index: number }[] = [];
  for (const pattern of namedStagePatterns) {
    pattern.lastIndex = 0;
    for (const match of plain.matchAll(pattern)) {
      const value = stageNames[match.groups?.stage ?? ""];
      const index = match.index ?? 0;
      if (value && !found.some((f) => index < f.index + f.phrase.length && f.index < index + match[0].length)) found.push({ value, phrase: match[0], index });
    }
  }
  return found.sort((a, b) => a.index - b.index);
}

export function namesInstitution(name: string): boolean {
  const words = tokens(name);
  while (words.length && leadingWords.has(words[0])) words.shift();
  return words.length >= 2 && institutions.has(words[0]);
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
