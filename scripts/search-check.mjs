import { writeFileSync } from "node:fs";

const [, , host, out] = process.argv;
if (!host || !out) {
  console.error("usage: node scripts/search-check.mjs <host> <out.json>");
  process.exit(1);
}

const queries = [
  ["Q1", "Quando ele foi para Lisboa?"],
  ["Q2", "Who was Ed?"],
  ["Q3", "la imprenta en Málaga"],
  ["Q4", "o livro azul da professora"],
  ["Q5", "aprender a nadar no rio"],
  ["Q6", "casamento"],
  ["Q7", "when was Tom born"],
  ["Q8", "voltar para o Recife"],
];

const results = [];
for (const [id, q] of queries) {
  const outcome = await (await fetch(`${host}/api/search?q=${encodeURIComponent(q)}`)).json();
  const moments = (outcome.moments ?? []).map((m) => ({ story: m.storyTitle, at: Math.round(m.start), text: m.text }));
  results.push({ id, q, strength: outcome.strength, semantic: outcome.semantic, moments });
  console.log(`${id} ${q} → ${outcome.strength}: ${moments.map((m) => m.story).join(" | ") || "nothing"}`);
}
writeFileSync(out, JSON.stringify(results, null, 2));
