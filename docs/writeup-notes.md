# Write-up notes (raw material for the DEV article)

Running log of decisions, measurements and surprises. English, so it can be lifted into the article.

## The one rule

The AI never replaces the memory. The recording is the artifact; the AI is the index.

How that shows up in the product:

- Search returns **moments**, never answers. The result sentence is a template ("Found three moments where Lúcia talked about this."), not model output.
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

The UI borrows the cataloguing convention for information supplied by the archivist: **brackets**. `[c. 1966]` is inferred; `1958` is not. Nothing depends on colour alone. Hollow dots mark inferred dates on the timeline, solid dots dated ones.

## "Does this really need AI?" Replaced with code

Each of these started as something the model "could do" and became deterministic code:

- **Year from age.** "eu tinha 18 anos" + birth year → `[c. 1966]`. A regex plus a Portuguese/English/Spanish number-word parser. The model was inconsistent across runs; the code isn't.
- **Stage of life from a dated story.** Age 30 in 1978 → adult life. The model once said "childhood" for the move to Fortaleza at 30.
- **Period of an undated story.** It inherits the year of the story told right before it in the same recording, labelled inferred: "Told right after a story from about 1978, in the same recording."
- **Story boundaries.** Small gaps the model leaves between stories are closed. A gap ending in a question goes to the *next* story, because questions introduce stories. An opening question ("Você quer saber como eu conheci o seu avô?") joins the first story.
- **Proper names in titles.** Gemma wrote "Mudança para fortaleza"; the code restores capitals from verified entity names.
- **Related stories.** Shared people and places. No LLM call.
- **Search sentence and confidence.** A template, plus thresholds over cosine similarity, the gap between the first and second result, and keyword coverage.
- **Time said in words.** "42 anos tocando" becomes a span from the story's year to +42; "dois anos depois" becomes a point two years later. Same number parser as ages, two small pattern lists per language.
- **Every mention, not just the first.** The model annotates a person once. The code then scans the word timestamps for every known name and alias, so the second "José" also lights up at the right second.

## Listening reveals the structure

Playing a memory used to light a few arcs for five seconds and forget them. Now the playback builds a picture that stays:

- The memory opens **in place on the lifeline**: its vestige becomes a waveform at its own year, and the rest of the life recedes.
- When a name is spoken, it appears above the waveform at that second, and threads drop from that exact point to every other moment of the life where the same person or place appears. Those moments come back from the background.
- When time is spoken, it lands on the axis. "Eu tinha 18 anos" marks *age 18* and the stage *youth*. "42 anos tocando" draws a span from 1966 to 2008 that ends just before José's last memory (2010). "Dois anos depois" places the wedding at c. 1968.
- Nothing fades. Whatever has been heard stays, quieter, and the current mention takes the voice colour for five seconds.
- At the end the trace remains, and the memory says what it touched: "This memory reaches from 1954 to 2010, through 8 other moments", plus the open question it left ("What was the church where the wedding took place?").

Everything is derived from timestamps that already exist. Nothing is generated during playback, and ten seconds with no new name or date show only the waveform moving. Positions of labels are packed from the whole story before playback starts, so nothing jumps when a new name appears.

The reveal layer is `aria-hidden`. The same information sits in the panel as a list with "play from here" buttons, keyboard order goes fragment → play → waveform slider, Escape closes the memory, and with reduced motion every thread is drawn at once.

**A benchmark that changed the hierarchy.** I compared this with Horizonte, a music player I built earlier where the album *is* the interface. What makes it land is that one object owns the screen, that zooming from collection to track is one continuous change of scale instead of a new view, and that every reaction is measured from the real audio, with a hard ceiling so it accents instead of dancing. Cofre keeps its own quiet, editorial language, so none of the shaders, darkness or motion came over. The structural lessons did: the lifeline owns the screen, opening a memory is a change of scale on the line rather than a big player below it, and every visual reaction comes from something that was actually said.

## Bugs found by looking at real output

- **Prompting Whisper with names merged segments.** Passing `--prompt "Lúcia, José, Quixadá…"` improves name spelling, but made whisper.cpp emit ~30-second segments, so a story boundary landed mid-sentence. Fix: re-segment into sentences from the word timestamps (sentence punctuation + pauses > 1.2 s). Segmentation no longer depends on Whisper's chunking.
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

- Long sessions are slow to organize: annotation runs story by story at ~30 s each on E4B, so a 30-minute session with 35 stories takes ~19 minutes. Transcription stays fast (~9× real time). Next step: annotate stories in parallel (Ollama `OLLAMA_NUM_PARALLEL`), or use E2B for long sessions.
- On a 16 GB laptop, having Gemma (4.3 GB resident) loaded while Whisper runs pushed the machine into swap. The pipeline now unloads Gemma before transcribing and reloads it for the organizing step.

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
