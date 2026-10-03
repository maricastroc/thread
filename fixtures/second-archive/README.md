# Second archive: generalization fixture

A second, fully isolated archive used to check that Thread's behaviour does not depend on the demo. Different narrator (Armando, born 1939), different places, three languages, and constructions that never appear in the demo's recordings. Nothing here may be used as a rule in the code: the fixture only exercises the general rules.

Run it against an isolated data directory:

```bash
COFRE_DATA_DIR=/tmp/cofre-second npx next start -p 3901
./scripts/fixture-archive.sh fixtures/second-archive http://localhost:3901
node scripts/archive-report.mjs /tmp/cofre-second http://localhost:3901 docs/generalization/<run>
```

Voices are the macOS "Grandpa" voices for pt-BR, en-GB and es-ES. The vault language is `auto`, so Whisper detects each recording's language.

## Expected behaviour, written before the first run

"Refuse" means the archive must not represent the relation, because the words do not establish it.

| id | recording | words | expected |
|---|---|---|---|
| C1 | 01 pt | Eu nasci em Olinda, em 1939 | year 1939 said; place Olinda |
| C2 | 01 pt | rio Beberibe | named place |
| C3 | 01 pt | Meu pai tinha quarenta anos quando eu nasci | father, said. The age is the father's: refuse as the narrator's age |
| C4 | 01 pt | porto do Recife | named place Recife |
| C5 | 01 pt | O meu avô trabalhou trinta anos naquele porto | grandfather. A 30-year duration with no known start: a length, never a placed span |
| C6 | 01 pt | A minha irmã Bia | person Bia (short name), sister |
| C7 | 01 pt | Quando eu tinha sete anos | narrator aged 7, so about 1946 (calculated) |
| C8 | 01 pt | o Zé, filho da vizinha | person Zé (two letters) |
| C9 | 01 pt | A mãe do Zé | Zé's mother: refuse as the narrator's mother |
| C10 | 01 pt | A minha mãe… costureira | narrator's mother |
| C11 | 01 pt | atrás da igreja de São Bento | named place; links to C37 |
| C12 | 01 pt | a dona Lu | person Lu (two letters), teacher |
| C13 | 01 pt | Por volta de 1950 | approximate year, said |
| C14 | 02 pt | Em 1958 eu fui pra Lisboa… bairro de Alfama | year 1958 said; places Lisboa, Alfama |
| C15 | 02 pt | No ano seguinte eu conheci a Helena | one year after 1958, which is stated earlier in the same story: about 1959, inferred. Person Helena |
| C16 | 02 pt | O pai da Helena não gostou de mim | Helena's father: refuse as the narrator's father |
| C17 | 02 pt | Cinco anos mais tarde a gente casou numa igreja pequena, perto do rio | the reference point is in the previous story: refuse to place. "igreja pequena" and "rio" are generic: refuse links to C11 and C2 |
| C18 | 02 pt | A Bia veio do Brasil | Bia links to C6 |
| C19 | 02 pt | Depois de dez anos em Lisboa | the reference point is in the previous story: refuse to place |
| C20 | 03 en | We arrived in London in 1968 | year 1968 said; place London |
| C21 | 03 en | I was twenty-nine | narrator aged 29, consistent with 1968 |
| C22 | 03 en | Mrs Hill was seventy years old | someone else's age: refuse |
| C23 | 03 en | Ed, a man from Leeds | person Ed (two letters); place Leeds |
| C24 | 03 en | He had worked at the docks for twenty years | someone else's 20-year duration, no known start: a length only |
| C25 | 03 en | Two years later, our son Tom was born | reference point in the previous story: refuse to place. Person Tom, son |
| C26 | 03 en | The next year… the church on Elm Street | relative to a relative date: refuse to place. Named place Elm Street |
| C27 | 03 en | Helena said… | Helena links to C15 across languages |
| C28 | 04 es | En 1975 nos mudamos a Málaga | year 1975 said; place Málaga |
| C29 | 04 es | Yo tenía treinta y seis años | narrator aged 36, consistent with 1975 |
| C30 | 04 es | Paco, el hermano de Helena | person Paco; refuse as the narrator's brother |
| C31 | 04 es | vivía allí desde hacía quince años | 15-year duration with no known start: a length only |
| C32 | 04 es | Cinco años después… junto a la iglesia del pueblo | five years after 1975, stated earlier in the same story: about 1980. "iglesia del pueblo" is generic: refuse |
| C33 | 04 es | Mi madre murió con noventa años, en Olinda | someone else's age: refuse. Olinda links to C1. "madre" and "mãe" are not linked across languages |
| C34 | 05 pt | Em oitenta e cinco a gente voltou pro Recife | year 1985 said, in words; Recife links to C4 |
| C35 | 05 pt | Eu passei quarenta anos compondo os livros dos outros | 40-year duration, no known start: a length only |
| C36 | 05 pt | Hoje a Bia tem oitenta e oito anos | someone else's age: refuse. Bia links to C6 |
| C37 | 05 pt | em Olinda, do lado da igreja de São Bento | links to C1 and C11 |
| C38 | 05 pt | O Tom vem visitar | Tom links to C25 across languages |
| C39 | 05 pt | O Zé morreu… o rio onde ele me ensinou a nadar | Zé links to C8; "o rio" is generic: refuse |

## Search questions

| id | question | expected story |
|---|---|---|
| Q1 | Quando ele foi para Lisboa? | arrival in Lisbon (02) |
| Q2 | Who was Ed? | London print shop (03) |
| Q3 | la imprenta en Málaga | Málaga (04) |
| Q4 | o livro azul da professora | school in Olinda (01) |
| Q5 | aprender a nadar no rio | childhood in Olinda (01) |
| Q6 | casamento | wedding in Lisbon (02) |
| Q7 | when was Tom born | Tom and the flat (03) |
| Q8 | voltar para o Recife | return to Recife (05) |
