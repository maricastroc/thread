# Generalization proof

Does Thread work for any person and any recording, or only for the demo? A second archive, fully isolated through `COFRE_DATA_DIR`, was run through the whole pipeline (audio → transcription → interpretation → provenance → persistence → timeline → playback) twice: on the code as it was (`baseline/`) and after the generalization work (`final/`). Same audio files, same narrator, same expectations, written before the first run in [`fixtures/second-archive/README.md`](../../fixtures/second-archive/README.md).

Each run folder holds `report.md` (every story with its transcript, facts, evidence, timestamps, refusals and what playback shows), `archive.json`, `life.json` (exactly what the lifeline receives), `search.json` and screenshots.

## What changed between the two runs

1. **No demo content in the model's prompt.** The annotation examples were taken from the demo's recordings ("Dona Mocinha", "o Zé" → "José", "born in 1948"). They are now neutral, invented examples. Notes shown to the family are written by code; the model's own reasoning is never displayed.
2. **Time read from the words, conservatively.** Ages count for the narrator only when the words say so ("eu tinha", "yo tenía", "I was"). Relative dates ("no ano seguinte", "cinco anos mais tarde", "depois de dez anos", "after N years", "N años después") resolve only against a year said earlier in the same story, with no other relative expression in between. Durations are lengths and never become placed spans. Years the model calculated are accepted only when a narrator's age in the same words reproduces them. Said approximations ("por volta de 1950", "around", "hacia") stay approximate.
3. **Names link only when the words establish it.** A place must have a proper name; "the river" or "a small church" never connects two stories. A kinship word counts as the narrator's relative only with "my" ("minha mãe", "mi madre", "my mother"), so "a mãe do Zé" and "o pai da Helena" stay other people. Extra mentions found in the transcript count only when written as a name (capitalized), and two-letter names (Zé, Lu, Ed) now count.
4. **Derived knowledge is persisted.** Mentions, narrator ages, relative dates and durations are stored as `marks` with their evidence, timestamp, provenance and, when refused, the reason. Model proposals the verifier rejects are stored in `rejections`. The lifeline reads both; it no longer parses anything.
5. **Nothing narrated is left outside a story.** Stretches the model skipped are offered to it again; whatever remains joins the neighbouring story.
6. **Orphan entities are deleted** when recordings are removed or reprocessed, so a new person never inherits a name, alias or relation from an old one.
7. **Density follows a disclosure rule** (see below).
8. **Search treats kinship words generally** instead of carrying stopwords picked for one demo question.

## Case by case

✓ matches the expectation · ✗ wrong · – not represented · ⚠ deviation on the safe side

| case | expectation | baseline | final |
|---|---|---|---|
| C1 | 1939 said; Olinda | ✓ year · place heard as "Linda" | ✓ year · place heard as "Linda" (speech recognition) |
| C2 | rio Beberibe | ✓ | ✓ |
| C3 | father's age is not the narrator's | ✗ shown as "age 40 → 1979" | ✓ refused: someone else's age |
| C4 | Recife | ✓ | ✓ and now links to the return in 1985 |
| C5 | 30-year duration, not placed | – not detected | ✓ "30 years", not placed |
| C6 | Bia, sister | ✓ | ✓ |
| C7 | aged 7 → about 1946 | ✓ | ✓ |
| C8 | Zé | ✓ | ✓ |
| C9 | Zé's mother is not the narrator's | ✗ narrator's mother lit on "a mãe do Zé" | ✓ separate person; kinship mention refused |
| C10 | narrator's mother | ✓ | ✓ |
| C11 | igreja de São Bento, links to C37 | ✓ | ✓ |
| C12 | Lu | ✓ (as Dona Lu) | ✓ (as Dona Lu, alias Lu) |
| C13 | approximate 1950 | ✗ exact | ✓ c. 1950 (1948–1952) |
| C14 | 1958; Lisboa; Alfama | ✓ | ✓ |
| C15 | one year after 1958 → about 1959 | ✗ model's 1959 with no evidence | ✓ derived from "No ano seguinte" at 0:12.3; the model's 1959 rejected |
| C16 | Helena's father is not the narrator's | ✗ narrator's father lit, thread to his birth | ✓ refused: kinship word without "my" |
| C17 | chained "cinco anos mais tarde" refused; generic church and river refused | ✗ model's 1964; "igreja pequena" and "rio" linked stories | ✓ refused; no generic places |
| C18 | Bia links | ✓ | ✓ |
| C19 | chained "depois de dez anos" refused | ✗ model's "1964–1974" (wrong reference) | ✓ refused |
| C20 | 1968; London | ✓ | ✓ |
| C21 | aged 29 | – not detected | ✓ "I was 29" → 1968 |
| C22 | landlady's age refused | ✓ (not detected) | ✓ detected and refused |
| C23 | Ed; Leeds | ✓ | ✓ |
| C24 | 20-year duration, not placed | ✗ drawn as a 1968–1988 span | ✓ length only |
| C25 | "Two years later" refused | ✗ point at 1970 | ✓ refused |
| C26 | "The next year" refused; Elm Street | ✗ model's 1971 | ✓ refused; Elm Street |
| C27 | Helena links across languages | ✓ | ✓ |
| C28 | 1975; Málaga | ✓ | ✓ |
| C29 | aged 36 | ✓ | ✓ |
| C30 | Paco is not the narrator's brother | ✓ | ✓ |
| C31 | 15-year duration, not placed | – not detected | ✓ length only |
| C32 | five years after 1975 → about 1980 | – sentence left outside every story | ⚠ refused: a duration sits between the year and the offset |
| C33 | mother's age refused; Olinda links; "madre" ≠ "mãe" | – left outside every story | ✓ all three |
| C34 | 1985, said in words | – left outside every story | ✓ extracted from "Em 85" |
| C35 | 40-year duration, not placed | – left outside every story | ✓ length only |
| C36 | Bia's age refused | ✗ story placed in 1936, before the narrator was born | ✓ refused; story placed in 1985 |
| C37 | Olinda and São Bento link | partial | ✓ |
| C38 | Tom links across languages | ✓ | ✓ |
| C39 | Zé links; "o rio" refused | – left outside every story | ✓ |

**Baseline:** 19 of 39 as expected and one more partly, 11 wrong, 3 not detected, and 5 lost because whole sentences fell outside every story. **Final:** 38 of 39 as expected; C32 is refused where a person would resolve it, the conservative side of the rule.

Search: the same eight questions return the expected story first in both runs, but the baseline also returned moments that belonged to no story, and "voltar para o Recife" found nothing. The final run finds it, and every result belongs to a story.

## How facts appear in the visualization

| fact | on the lifeline, as it plays | in the panel |
|---|---|---|
| person or place, said | the name appears above the waveform at that second, with a dot; threads drop to every other moment with the same name while it is being said, then condense to one faint thread to the nearest moment; connected moments stay highlighted | the name with its kind or relation, a dot that lights when it is said, and a button to play from that second |
| narrator's age | "age N" in the row of life stages, at its year, and that stage is marked | "age N" with the words and their time |
| resolved relative date | a hollow point at c. YEAR, joined to the story's year, labelled with the words | "c. YEAR" with the words and their time |
| duration | a label with the length and the words, at the story's own place; no span | "N years" with the words and their time |
| said approximate year | the story sits on a band (c. 1950 means 1948–1952) | "c. 1950" without brackets, because it was said |
| refused anything | nothing | nothing; kept in the archive with its reason |

## Density

A third isolated archive (`fixtures/dense-archive`) went through the same pipeline: 63 stories in 6 recordings, 35 people and 24 places, three people in 12 to 15 stories each. Captures are in `dense/screens/`.

The rule is progressive disclosure that never drops information silently: the life is always whole, and detail follows attention.

- **Overview.** Every story keeps its vestige at its year. A period stacks at most six rows; beyond that it shows "+N" at its own place, and that mark lists every story of the period. At 1280 px the dense archive peaks at six rows; at 860 px the 1951 cluster condenses to "+3".
- **Names bar.** People and places are ordered by how many moments they connect; what doesn't fit is announced ("27 more") and one click away.
- **A memory playing.** Only the name being said draws all its threads, in the voice colour. Dalva, in 15 stories, draws 14 threads while her name is heard; when the next name comes, she condenses to one faint thread to her nearest moment, and her other moments stay highlighted. Two connected people spoken within seconds no longer produce 27 lines at once.
- **Labels.** A name above the waveform is placed only at the second it was said, on one of two lines. If it doesn't fit, its dot stays and the name is in the panel and on hover: a label never drifts away from its moment.
- **Hidden but connected.** If a story in a "+N" mark connects to the memory playing, the mark lights up and receives the thread.

## What is still limited

- **Speech recognition misspells names and loses capitals**, above all with synthetic voices: Olinda → Linda, Bia → Biá, São → Sã, and in the demo "a dona mocinha" and "açude do cedro" in lowercase. Identity is by name and names must be written as names, so "Linda" and "Olinda" are two places, the reservoir is refused as a common noun, and the demo's grandmother is now "Avó": before, only the demo's own example in the prompt made the model guess "Dona Mocinha". Correcting a name once and teaching the transcription is the obvious next feature.
- **The relative-date rule is conservative.** A duration between a year and "five years later" blocks the resolution (C32, and the demo's "dois anos depois"). A person can tell which way the duration looks; the parser can't, so it refuses.
- **Dropped subjects lose ages.** "Tinha sete anos quando…" without "eu" is refused, although Portuguese and Spanish speakers often omit the pronoun.
- **Kinship doesn't cross languages.** "mi madre" and "minha mãe" are the same person to the family and two words to the archive, so they don't link.
- **Generic places never link**, even when they are the same church in the same town.
- **Durations are never placed**, even when a person knows when they began ("42 anos tocando" after the meeting).
- **Story boundaries still come from the model.** Two scripted pairs of stories came back as single stories; narration is no longer lost, but a title may not cover everything attached to it.
- **The model still proposes years it can't support** (six rejected in this archive), which costs time but no longer reaches the screen.
- **Three languages.** The time parser and the kinship words cover Portuguese, Spanish and English.
