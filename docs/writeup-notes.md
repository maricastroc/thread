# Write-up notes (raw material for the DEV article)

Running log of decisions, measurements and surprises. English, so it can be lifted into the article.

## The one rule

The AI never replaces the memory. The recording is the artifact; the AI is the index.

How that shows up in the product:

- Search returns **moments**, never answers. The result sentence is a template ("Found three moments where Kiara talked about this."), not model output.
- Every result has "Listen from 0:42", which plays her voice from that second.
- The transcript is labelled as machine-written: "Written down by speech recognition. The recording is the original."
- Titles are labelled "Title suggested by the archive", and the family can rename them. A renamed title is marked `family` and never overwritten by a reprocess.
- The pull-quote under each story is **not model text**. Gemma returns only a segment number, and the page shows the words Whisper heard. The model chooses; it never writes.
- No summaries anywhere. A summary is a retelling, and retelling is exactly what we promised not to do.

## Why these models

**whisper.cpp + `large-v3-turbo` (q8_0, 874 MB): listen.**

- It gives timestamps for every word, which is what lets a search result, a person's name or a year link to an exact second.
- Its multilingual quality holds up on Brazilian Portuguese with a regional accent.
- It runs on Metal.
- Silero VAD (`ggml-silero-v6.2.0`) is on, because older speakers pause a lot, and Whisper fills long silences with hallucinations like "Legendas pela comunidade Amara.org". A small deterministic filter catches the known phrases that slip through.

**Gemma 4 E4B via Ollama: understand.**

- It runs comfortably on a 16 GB laptop alongside Whisper.
- Its Portuguese is strong.
- It produces structured output under a JSON Schema (grammar-constrained decoding), so we never parse free text.
- Ollama runs it with an MTP draft model (speculative decoding).
- `gemma4:12b` is the drop-in "quality mode". The 26B and 31B models don't fit a normal laptop.

**EmbeddingGemma 300M: find.**

- It is multilingual, 768 dimensions, and 622 MB.
- With its task prompts (`task: search result | query: …` and `title: … | text: …`), an English query finds a Portuguese moment ("the drought" → "a seca de cinquenta e oito"). Grandchildren who don't speak the language well can still find grandma's stories.
- So the whole "understand and find" side is Gemma.

**Local-first is the reason for open weights, not decoration.**

- These are voices, names, family conflicts and addresses.
- With open weights the recordings never have to go to a third-party API to be understood or searched. Runtime network traffic is localhost only: Next.js ↔ Ollama on `127.0.0.1:11434`.
- Fonts are self-hosted at build time by `next/font`.

## Provenance: verified, not declared

Every structured fact is stored with `provenance`, `seg`, `evidence` (the exact words), `start_sec` and `end_sec`, and `note`. That makes the chain field → transcript segment → second → audio part of the schema.

Gemma returns, for each claim, `{ segment, mention, explicit, … }`, with the evidence fields placed **before** the conclusion in the schema, so the model quotes before it concludes. Then plain code decides the label, the same way for any model:

1. Look for the mention in the cited segment, then the rest of the story. Accent- and case-insensitive, with a tolerant token match.
2. A person or place with no evidence is **dropped**.
3. Name literally in the segment → **said**. Found, but normalized ("o Zé" → José, "meu pai" → Antônio) → **from the words**.
4. A time claimed as explicit must contain a year-like phrase: digits, or number words like "setenta e oito", but **not** followed by "anos". If not, it is downgraded to **inferred**.
   - Real catch: the model labelled 1966 as stated because the narrator said "eu tinha 18 anos". The code saw an age, not a year, and relabelled it inferred, with the note "Calculated from “eu tinha 18 anos” and the year of birth, 1948."
5. Inferred facts can still cite evidence: the words the inference was based on.
6. A person whose name is built as an institution's, an institution word followed by the rest of the name ("Banco do Brasil", "Escuela Normal", "Bank of England"), is refused: the words support the name, not that it is a person. A single word stays a person, since it can be a surname or a nickname.
   - Real catch: Gemma filed "Colégio das Freiras" as a person in the human reading of Fortaleza.
7. A stage of life counts as stated only when the narrator says an age ("eu tinha 8 anos", "I was fifteen", "yo tenía 70 años") or names the stage as their own ("quando eu era criança", "na minha adolescência", "as a child, I", "en mi juventud"). An activity that suggests a stage ("comecei a trabalhar", "casei", "tive meu primeiro filho") keeps the model's stage only as inferred, citing those words. A stage with no words behind it is refused, and so is one the words contradict.
   - Real catch: Gemma claimed "eu comecei a costurar pra fora" stated adulthood, and the verifier, which only checked that the words existed, labelled it from the words.
8. A person or place counts as said only when its name is said as one expression. A name the model builds from words said apart is refused; when the model adds words to a short name that was said, only the words actually said are kept ("Maria" from "a Maria", never "Maria Silva"). A word in lowercase, or capitalized only because it starts a sentence, counts as a name only when it is written as a name elsewhere in the recording or the archive already knows it; otherwise it is refused as a common word.
   - Real catch: Gemma proposed a place "Bodega do pai" for "na bodega" and "O meu pai".
9. Interpreting a recording again first forgets the people and places that only its previous interpretation supported, so an old spelling can't lend its name to what is said now. People and places supported by any other story stay.
   - Real catch: "Iquixadá", from the transcript of the synthetic voice, kept absorbing the human reading's "Quixadá" and showed as said.

The UI borrows the cataloguing convention for information supplied by the archivist: **brackets**. `[c. 1966]` is inferred; `1958` is not. Nothing depends on colour alone. Hollow dots mark inferred dates on the timeline, solid dots dated ones.

## "Does this really need AI?" Replaced with code

Each of these started as something the model "could do" and became deterministic code:

- **Year from age.** "eu tinha 18 anos" + birth year → `[c. 1966]`. A regex plus a Portuguese/English/Spanish number-word parser. The model was inconsistent across runs; the code isn't.
- **Stage of life from a dated story.** Age 30 in 1978 → adult life. The model once said "childhood" for the move to Fortaleza at 30.
- **Period of an undated story.** It takes the year said in the story told right before it in the same recording, labelled inferred: "Told right after a story from 1978, in the same recording." Only a year the words say is carried, and only once: a year that is itself an inference, carried from an earlier story or calculated from an age, is never the basis for another. The story then stays undated, and the refusal is kept with its reason, even when another rule would also have stopped the year.
- **Story boundaries.** Small gaps the model leaves between stories are closed. A gap ending in a question goes to the *next* story, because questions introduce stories. An opening question ("Você quer saber como eu conheci o seu avô?") joins the first story.
- **Proper names in titles.** Gemma wrote "Mudança para fortaleza"; the code restores capitals from verified entity names.
- **Related stories.** Shared people and places. No LLM call.
- **Search sentence and confidence.** A template, plus thresholds over cosine similarity, the gap between the first and second result, and keyword coverage.
- **Time said in words.** "No ano seguinte", "cinco anos mais tarde", "after two years" resolve only against a year said earlier in the same story, with nothing relative in between; otherwise they are refused. "42 anos tocando" is a length, never a placed span, because the words don't say when it began. Same number parser as ages, a few pattern lists per language.
- **Whose age it is.** "Eu tinha 18 anos" is the narrator's; "meu pai tinha 40 anos" and "a Bia tem 88 anos" are not, and are refused with that reason instead of moving a story to the wrong decade.
- **Every mention, not just the first.** The model annotates a person once. The code then scans the word timestamps for every known name, so the second "José" also lights up at the right second. It only counts words written as names: "rio" never becomes "rio Beberibe", and "mãe" counts as the narrator's mother only after "minha".

## Listening reveals the structure

Playing a memory used to light a few arcs for five seconds and forget them. Now the playback builds a picture that stays:

- The memory opens **in place on the lifeline**: its vestige becomes a waveform at its own year, and the rest of the life recedes.
- When a name is spoken, it appears above the waveform at that second, and threads drop from that exact point to every other moment of the life where the same person or place appears. Those moments come back from the background.
- When time is spoken and the words establish it, it lands on the axis. "Eu tinha 18 anos" marks *age 18* and the stage *youth*. "42 anos tocando" shows as a length at the story's own place, not as a span, and "dois anos depois" is refused because the 42 years sit between it and the year: a person can tell, the parser can't, so nothing is invented.
- Nothing fades. The name being said takes the voice colour and draws all its threads; when the next name arrives, the previous one condenses to a single faint thread to its nearest moment, and its other moments stay highlighted. Detail follows attention, and the trace stays.
- At the end the trace remains, and the memory says what it touched: "This memory reaches from 1954 to 2010, through 7 other moments", plus the questions it left ("What was the atmosphere like at the festa de São João?").

Everything is derived from timestamps that already exist. Nothing is generated during playback, and ten seconds with no new name or date show only the waveform moving. Positions of labels are packed from the whole story before playback starts, so nothing jumps when a new name appears.

The reveal layer is `aria-hidden`. The same information sits in the panel as a list with "play from here" buttons, keyboard order goes fragment → play → waveform slider, Escape closes the memory, and with reduced motion every thread is drawn at once.

**A benchmark that changed the hierarchy.** I compared this with Horizonte, a music player I built earlier where the album *is* the interface. What makes it land is that one object owns the screen, that zooming from collection to track is one continuous change of scale instead of a new view, and that every reaction is measured from the real audio, with a hard ceiling so it accents instead of dancing. Thread keeps its own quiet, editorial language, so none of the shaders, darkness or motion came over. The structural lessons did: the lifeline owns the screen, opening a memory is a change of scale on the line rather than a big player below it, and every visual reaction comes from something that was actually said.

## One accent, two lights

The last round before submission was about being understood in a few seconds, without adding features.

- **The main action says the intention.** The header's Record became "Add a story": a short panel for the archive's person with "Record a story" and "Import a recording". Inside Recordings the literal words stay.
- **The Life works without playing.** At rest every mark draws the shape of its own voice, and the hero says how much of the life has one: "A voice kept for 8 of 78 years."
- **Listening leaves a mark.** The part of a story you heard turns to ink, like the played part of a player, and stays for the session. When a memory ends it draws its threads to everything it touched.
- **Source and interpretation look related but different.** A recording shows its whole waveform with each story as a numbered span; a story shows a thin ruler with its place in the recording.
- **People and places are threads.** Each one is a line on the same axis as the life, with a dot in every year it appears.
- **Colour means one thing.** The coral/vermilion is only the voice that is sounding now. Errors got their own red and evidence a neutral marker. The tokens are named by role and defined once as light and dark pairs; the light theme is warm ivory paper. Measuring showed why shared opacities were not enough: the same line loses contrast on the light background, so each theme gets its own values.
- **No flash.** The theme choice lives in a cookie, so the server renders the right theme before anything paints.

## Does it work for anyone? A second archive

To check that none of this depends on the demo, a second archive with a different narrator (Armando, born 1939), three languages and deliberately different constructions went through the whole pipeline in an isolated data folder, before and after the generalization work. The expected result for each of 39 cases was written down before the first run. The code as it was got 19 right and one partly, 11 wrong (a father's age shown as the narrator's, "o pai da Helena" lighting up the narrator's father, a story placed in 1936, three years before the narrator was born), missed 3 and lost 5 because whole sentences fell outside every story. After the changes: 38 of 39, and the one miss is a refusal on the safe side. A third archive with 63 stories and 59 names checks density. Everything is in `docs/generalization/`.

## Bugs found by looking at real output

- **Prompting Whisper with names merged segments.** Passing `--prompt "Kiara, José, Quixadá…"` improves name spelling, but made whisper.cpp emit ~30-second segments, so a story boundary landed mid-sentence. Fix: re-segment into sentences from the word timestamps (sentence punctuation + pauses > 1.2 s). Segmentation no longer depends on Whisper's chunking.
- **VAD shifted the word timestamps.** With `--vad`, whisper.cpp maps segment times back to the original audio, but token times in `-ojf` stay on the VAD-compressed timeline. Words drifted up to 10 s by the end of a 2-minute recording. Fix: linearly remap each segment's tokens onto its mapped range.
- **Accented words came out broken.** Token text in the JSON can split UTF-8 characters across tokens ("á" = two tokens). Reading the file as latin1 and re-assembling each word's bytes keeps "Quixadá" intact.

## Measured on a MacBook (M4, 16 GB), all local

| step | time |
|---|---|
| whisper.cpp large-v3-turbo q8, 1 min 51 s of speech | 11.6 s (~10× real time, warm) |
| Gemma 4 E4B, generation | ~13–16 tokens/s with schema, draft acceptance 40–60% |
| Gemma 4 E4B, finding + annotating stories | 33–86 s per recording (1–4 stories) |
| EmbeddingGemma, indexing ~16 moments | 0.1 s warm (23 s on first load) |
| Whole pipeline, 1 min 51 s recording | ~2 min |
| Stress test: 30-minute session (400 sentences, 35 stories) | preserve 13 s · transcribe 3 min 17 s · organize 19 min · index 3 s |

The processing screen is designed around this. You see the waveform fill as the words are written, then the stories appear one by one, and the page says the work continues on this computer.

## Limitations (honest list)

- **One person per archive, and the archive assumes that person is the one speaking.** Thread keeps the life of one person, the archive's subject, and a recording may come from anyone. But the interpreter and the first-person rules still treat the speaker as the subject: "eu tinha 10 anos" becomes the subject's age and "minha mãe" the subject's mother. If a granddaughter records "minha avó Kiara sempre contava…", her own age and her own mother would be attributed to Kiara. The coupling lives in the prompt (`interpreter/prompts.ts`), in the first-person rules (`numbers.ts`, `words.ts`) and where they meet the subject's year of birth (`derive.ts`, `provenance.ts`); the pipeline hands the subject to the interpreter as the narrator in one place (`pipeline.ts`). The safe next step is to mark who is speaking in each recording and refuse every first-person inference when it isn't the subject.

- Long sessions are slow to organize: annotation runs story by story at ~30 s each on E4B, so a 30-minute session with 35 stories takes ~19 minutes. Transcription stays fast (~9× real time). Next step: annotate stories in parallel (Ollama `OLLAMA_NUM_PARALLEL`), or use E2B for long sessions.
- On a 16 GB laptop, having Gemma (4.3 GB resident) loaded while Whisper runs pushed the machine into swap. The pipeline now unloads Gemma before transcribing and reloads it for the organizing step.

- The verification rules read words, not meaning, and stay on the safe side. A stage of life said without tying it to the narrator ("na adolescência fui pro Rio") is not recognised as stated, and neither is an age said without a subject: in Fortaleza, "Trinta anos de idade e nunca tinha visto o mar" leaves the stage of life calculated from 1978 instead of taken from the words. An institution whose name ends with the institution word, common in English ("St Mary's School"), can still pass as a person. A stage the model infers from an activity is kept, labelled inferred, but no code can tell whether that inference is right. A name that only appears at the start of a sentence, or only in lowercase, is refused unless it is written as a name elsewhere in the recording or the archive already knows it.
- Some interpretation choices stay as the model made them. In Quixadá, the drought and the credit at the shop became one story, and São João's title, "Como conhecer o avô em festa", reads like an instruction. Titles, like themes, are labels no code checks. Annotations also vary between runs: when Quixadá was interpreted again, Gemma no longer proposed Ceará or the pedra da galinha Choca, and wrote the narrator's mother as "MÃE", since names of three letters keep the model's capitals.
- Themes are not verified. They are labels that no code checks against the words, and some are wrong: in the human reading of Fortaleza, the arrival by the sea was tagged "music" and the sewing story "travel". People, places and years are verified; themes are not yet.
- E4B is not deterministic across prompt changes: the same recording split into 1 or 4 stories depending on the question asked before it. The verification layer keeps facts honest, but segmentation still varies.
- A misheard name propagates. Whisper heard "Quixadá" as "Iquixadá" in the synthetic demo voice, and since known names feed Whisper's prompt, an error can be reinforced. Next step: let the family correct a name once and feed the correction back.
- No speaker diarization. The interviewer's questions are part of the transcript.
- Phone recording over the local network needs HTTPS (secure context for the microphone).
- The demo data uses a synthetic macOS voice (Luciana). The real thing is a person.

## Feedback from the real person

_To fill in after recording with the family._

- What they tried first:
- Where they hesitated:
- What they said when they heard the voice play back from a search:
