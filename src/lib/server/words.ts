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
