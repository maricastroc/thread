import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const out = path.resolve(process.argv[2] ?? "fixtures/dense-archive");
const birth = 1932;
let seed = 20261003;
const random = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (list) => list[Math.floor(random() * list.length)];
const weighted = (list) => {
  const total = list.reduce((sum, [, w]) => sum + w, 0);
  let r = random() * total;
  for (const [item, w] of list) if ((r -= w) <= 0) return item;
  return list[list.length - 1][0];
};

const people = [
  "Aurora", "Benedito", "Cícero", "Dalva", "Edite", "Fausto", "Glória", "Horácio", "Jandira", "Lourenço",
  "Mirtes", "Nestor", "Odete", "Plínio", "Quitéria", "Rosália", "Sebastião", "Tereza", "Ubirajara", "Valdemar",
  "Wanda", "Yolanda", "Zuleica", "Amélia", "Bernardo", "Celina", "Dirceu", "Estela", "Floriano", "Graciete",
  "Hilda", "Isaura", "Joaquim", "Leonor", "Marcelino", "Natália", "Osvaldo", "Penha", "Raimundo", "Salete",
  "Tadeu", "Ulisses", "Vicência", "Zacarias", "Alzira", "Bento", "Clotilde", "Durval", "Eunice", "Firmino",
  "Geralda", "Honório", "Ilda", "Jurandir", "Lindalva", "Moacir", "Nair", "Otília", "Noêmia", "Severino",
];
const places = [
  "Caruaru", "Garanhuns", "Campina Grande", "Juazeiro", "Petrolina", "Mossoró", "Natal", "João Pessoa", "Maceió", "Aracaju",
  "Salvador", "Feira de Santana", "Teresina", "São Luís", "Belém", "Manaus", "Brasília", "Goiânia", "Belo Horizonte", "Vitória",
  "Niterói", "Campinas", "Santos", "Curitiba", "Londrina", "Joinville", "Porto Alegre", "Pelotas", "Cuiabá", "Uberlândia",
];
const frequent = people.map((name, i) => [name, i < 4 ? 14 : i < 12 ? 5 : 1]);
const often = places.map((name, i) => [name, i < 5 ? 6 : 1]);

const openings = ["Tem outra lembrança.", "Agora uma coisa diferente.", "Outra história.", "Lembro também de outra vez.", "Deixa eu contar mais uma."];
const together = [
  (a, b) => `${a} e ${b} trabalhavam juntos numa loja de tecidos.`,
  (a, b) => `${a} cantava enquanto ${b} tocava violão na varanda.`,
  (a, b) => `${a} me ensinou a costurar, e ${b} ria dos meus pontos tortos.`,
  (a, b) => `${a} brigou com ${b} por causa de um terreno.`,
  (a, b) => `${a} trouxe doce de leite, e ${b} trouxe a sanfona velha.`,
  (a, b) => `${a} e ${b} se casaram numa manhã de chuva.`,
  (a, b) => `${a} cuidava das crianças, e ${b} vendia peixe na feira.`,
  (a, b) => `${a} escrevia cartas, e ${b} lia todas em voz alta.`,
];
const there = [
  (p) => `Isso foi em ${p}, numa casa de janelas azuis.`,
  (p) => `A gente morava em ${p} naquela época.`,
  (p) => `Fomos de ônibus até ${p}, uma viagem de dois dias.`,
  (p) => `Em ${p} chovia quase todo dia.`,
  (p) => `O mercado de ${p} era o lugar mais bonito que eu conhecia.`,
  (p) => `Depois disso a gente voltou para ${p}.`,
];

const years = [];
for (let i = 0; i < 60; i++) {
  const band = weighted([["early", 25], ["middle", 20], ["late", 15]]);
  const year = band === "early" ? 1938 + Math.floor(random() * 28) : band === "middle" ? 1966 + Math.floor(random() * 25) : 1991 + Math.floor(random() * 33);
  years.push(year);
}

const stories = years.map((year) => {
  const a = weighted(frequent);
  let b = weighted(frequent);
  while (b === a) b = weighted(frequent);
  const place = weighted(often);
  const age = year - birth;
  const kind = weighted([["year", 6], ["age", 3], ["none", 1]]);
  const anchor = kind === "year" ? `Em ${year}, aconteceu uma coisa que eu nunca esqueci.` : kind === "age" ? `Quando eu tinha ${age} anos, aconteceu uma coisa que eu nunca esqueci.` : "Isso eu não sei bem quando foi.";
  return `${pick(openings)} ${anchor} ${pick(together)(a, b)} ${pick(there)(place)}`;
});

mkdirSync(path.join(out, "roteiros"), { recursive: true });
const manifest = [];
for (let r = 0; r < 6; r++) {
  const name = `${String(r + 1).padStart(2, "0")}-gravacao.txt`;
  const text = stories.slice(r * 10, r * 10 + 10).join(" [[slnc 2600]]\n") + " [[slnc 2600]]\n";
  writeFileSync(path.join(out, "roteiros", name), text);
  manifest.push([name, "Grandma (Portuguese (Brazil))", `2026-07-${String(4 + r * 5).padStart(2, "0")}T10:00:00Z`, ""].join("\t"));
}
writeFileSync(path.join(out, "manifest.tsv"), manifest.join("\n") + "\n");
writeFileSync(path.join(out, "vault.json"), JSON.stringify({ narrator: "Conceição", birthYear: birth, language: "pt" }) + "\n");
console.log(`wrote ${stories.length} stories in 6 recordings to ${out}`);
