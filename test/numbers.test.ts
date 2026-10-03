import assert from "node:assert/strict";
import { test } from "node:test";
import { findAges, findDurations, findOffsets, isApproximate, statesYear } from "../src/lib/server/numbers";

const ages = (text: string) => findAges(text).map((a) => `${a.firstPerson ? "narrator" : "other"} ${a.age}`);

test("ages count for the narrator only in the first person", () => {
  assert.deepEqual(ages("Eu tinha 18 anos."), ["narrator 18"]);
  assert.deepEqual(ages("Eu devia ter uns oito anos quando eu subi nela."), ["narrator 8"]);
  assert.deepEqual(ages("Com 15 anos eu comecei a trabalhar."), ["narrator 15"]);
  assert.deepEqual(ages("I was twenty-nine, and I didn't speak English."), ["narrator 29"]);
  assert.deepEqual(ages("I was twelve when the war ended."), ["narrator 12"]);
  assert.deepEqual(ages("Yo tenía treinta y seis años."), ["narrator 36"]);
});

test("someone else's age is never the narrator's", () => {
  assert.deepEqual(ages("Meu pai tinha 40 anos quando eu nasci."), ["other 40"]);
  assert.deepEqual(ages("A minha mãe morreu com 90 anos."), ["other 90"]);
  assert.deepEqual(ages("Hoje a Bia tem 88 anos."), ["other 88"]);
  assert.deepEqual(ages("Mrs Hill was 70 years old."), ["other 70"]);
  assert.deepEqual(ages("Mi madre murió con noventa años."), ["other 90"]);
});

test("phrases that are not ages stay out", () => {
  assert.deepEqual(ages("Ela tinha dois anos de casada."), []);
  assert.deepEqual(ages("I was one of the first to arrive."), []);
});

test("relative dates in three languages", () => {
  const offsets = (text: string) => findOffsets(text).map((o) => o.value);
  assert.deepEqual(offsets("No ano seguinte eu casei."), [1]);
  assert.deepEqual(offsets("Cinco anos mais tarde nasceu a minha filha."), [5]);
  assert.deepEqual(offsets("Depois de dez anos a gente voltou."), [10]);
  assert.deepEqual(offsets("A gente casou dois anos depois."), [2]);
  assert.deepEqual(offsets("Two years later, our son was born."), [2]);
  assert.deepEqual(offsets("The next year we bought a flat."), [1]);
  assert.deepEqual(offsets("After two years in Leeds, we left."), [2]);
  assert.deepEqual(offsets("Cinco años después abrimos una imprenta."), [5]);
});

test("durations are found, and 'quando' is not a gerund", () => {
  const durations = (text: string) => findDurations(text).map((d) => d.value);
  assert.deepEqual(durations("O meu avô trabalhou 30 anos naquele porto."), [30]);
  assert.deepEqual(durations("E tocou. 42 anos tocando."), [42]);
  assert.deepEqual(durations("Eu passei quarenta anos compondo livros."), [40]);
  assert.deepEqual(durations("He had worked at the docks for twenty years."), [20]);
  assert.deepEqual(durations("Vivía allí desde hacía quince años."), [15]);
  assert.deepEqual(durations("Meu pai tinha 40 anos quando eu nasci."), []);
});

test("said years and approximations", () => {
  assert.equal(statesYear("A gente se mudou para Fortaleza em 78.", 1978), true);
  assert.equal(statesYear("Eu tinha 18 anos.", 1966), false);
  assert.equal(isApproximate("Por volta de 1950, ela me deu um livro.", 1950), true);
  assert.equal(isApproximate("It was around 1964, I think.", 1964), true);
  assert.equal(isApproximate("Em 1958 eu fui pra Lisboa.", 1958), false);
});
