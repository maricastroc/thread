import assert from "node:assert/strict";
import { test } from "node:test";
import { hasProperWord, isKinshipName, mentionsOwnKin } from "../src/lib/server/words";

test("kinship belongs to the narrator only with a first-person possessive", () => {
  assert.equal(mentionsOwnKin("A minha mãe nunca soube disso.", "Mãe"), true);
  assert.equal(mentionsOwnKin("A mãe do Zé ficava na margem.", "Mãe"), false);
  assert.equal(mentionsOwnKin("O pai da Helena não gostou de mim.", "Pai"), false);
  assert.equal(mentionsOwnKin("Mi madre murió en Olinda.", "madre"), true);
  assert.equal(mentionsOwnKin("Our son Tom was born.", "son"), true);
});

test("a place needs a proper name", () => {
  assert.equal(hasProperWord("igreja de São Bento"), true);
  assert.equal(hasProperWord("rio Beberibe"), true);
  assert.equal(hasProperWord("igreja pequena"), false);
  assert.equal(hasProperWord("o rio"), false);
});

test("relationship words used as names", () => {
  assert.equal(isKinshipName("Mãe"), true);
  assert.equal(isKinshipName("Avô"), true);
  assert.equal(isKinshipName("Helena"), false);
});
