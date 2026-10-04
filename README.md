# Thread

A life archive for one person, built from recordings.

Thread keeps one person's stories. You record or import conversations, and Thread builds that person's life from what was said: the stories, the people and places in them, and where each one sits in their life. It follows one rule: **the AI never replaces the memory.** The recording is the artifact. Search never answers with generated text; it takes you to the moment in the recording and plays the voice from there.

An archive has four layers, and each one leads back to the one before:

- **Recordings** are the evidence: every file added to the archive, kept exactly as it was received, even when nothing could be extracted from it.
- **Stories** are the interpretation: the separate memories found in a recording. A recording can hold several, one, or none.
- **The life** is the representation: the stories placed on the person's lifeline, connected through the people and places they share.
- **People and places** are the entities those stories mention, each one tied to the words that support it.

This version keeps one person per installation. Several archives side by side would be a layer above this one.

Everything runs on your machine. The recordings, transcripts and search index never leave it.

The hosted version is a read-only demo of a preprocessed archive. Thread is designed to run locally, where recordings are transcribed and interpreted on the user's machine using Whisper and Gemma.

```
record ──► preserve ──► discover ──► listen
           ffmpeg        whisper.cpp   the original voice,
           (original     Gemma 4       from the exact second
            kept as-is)  EmbeddingGemma
```

## How it works

| step | tool | what it does |
|---|---|---|
| Preserve | ffmpeg | keeps the original file untouched, makes a seekable copy for playback, draws the waveform |
| Listen | whisper.cpp · `large-v3-turbo` | writes down what was said, with a timestamp for every word; Silero VAD stops hallucinations in long pauses |
| Understand | **Gemma 4 E4B** via Ollama | finds where one story ends and the next begins, suggests a title, picks a quote by segment number, and notes people, places and dates with the exact words they came from |
| Find | **EmbeddingGemma** via Ollama + SQLite FTS5 | indexes ~30-second moments so “when she talked about living near the beach” finds the right minute, even across languages |

Gemma works as an archivist rather than a chatbot. It returns structured JSON (constrained by a JSON Schema), and every claim it makes is **checked against the transcript in code** before it is stored. The interface then labels it:

- **said**: the words are in the recording.
- **from the words**: taken from what was said, like `1978` from “setenta e oito”.
- **[inferred]**: deduced by the archive, never presented as memory. Brackets follow the cataloguing convention for information supplied by the archivist.

If Gemma cites words that aren't in the transcript, the claim is dropped. Each fact links to the segment, the second, and the audio. See [docs/design.md](docs/design.md) for the full design and [docs/writeup-notes.md](docs/writeup-notes.md) for the reasoning behind each decision.

## Requirements

- macOS or Linux, Node.js 22.13+
- ffmpeg, whisper.cpp (`whisper-cli`), Ollama
- About 8.5 GB of disk for the models; 16 GB of RAM is comfortable

On macOS:

```bash
brew install ffmpeg whisper-cpp ollama
```

## Setup

```bash
npm install
ollama serve
```

In another terminal:

```bash
npm run setup
```

`setup` checks the tools, downloads the Whisper and VAD models into `models/`, and pulls `gemma4:e4b` and `embeddinggemma` into Ollama.

## Run

```bash
npm run dev
```

Open http://localhost:3000, write whose stories you are keeping, and record.

To try the archive without recording, generate three short synthetic stories with the macOS `say` voice and import them:

```bash
npm run demo
```

## Recording from a phone

Browsers only allow the microphone on secure origins. `localhost` on the laptop counts as secure. A phone on the same Wi-Fi does not, unless you serve over HTTPS:

```bash
npm run dev:https
```

This uses a locally trusted certificate (mkcert). For a phone, make a certificate for your laptop's network address with `mkcert 192.168.x.x`, pass it with `--experimental-https-key` and `--experimental-https-cert`, and install the mkcert root certificate on the phone. Voice notes and phone recordings can also be imported as files from any device.

## Your data

Everything lives in `data/`:

- `data/recordings/<id>/original.*`: the recording exactly as it was received
- `data/recordings/<id>/audio.m4a`: the playback copy
- `data/cofre.db`: transcripts, stories, facts with provenance, and the search index (SQLite)

Back the archive up by copying the folder. A removed recording is moved to `data/removed/`, never erased.

## Changing models

The interpretation layer is a small interface, `StoryInterpreter` (`src/lib/server/interpreter/types.ts`), with two methods: `findStories` and `annotateStory`. Gemma is the implementation in use. Because the weights are open, switching models is configuration:

```bash
COFRE_INTERPRETER_MODEL=gemma4:12b npm run dev
npm run reprocess
```

`reprocess` re-reads every recording with the current model. The audio and transcripts stay as they are; only the index is rebuilt. Provenance checks live outside the interpreter, so any model goes through the same checks. See `.env.example` for every setting.

## Beyond the demo

Two more archives live in `fixtures/`: a second narrator in Portuguese, English and Spanish, with the expected result of every case written down, and a dense archive with 63 stories. Each one runs in its own data folder, so it never touches yours:

```bash
npm run build
COFRE_DATA_DIR=/tmp/cofre-second npx next start -p 3901
./scripts/fixture-archive.sh fixtures/second-archive http://localhost:3901
node scripts/archive-report.mjs /tmp/cofre-second http://localhost:3901 /tmp/report
```

The results before and after the generalization work, case by case, are in [`docs/generalization`](docs/generalization/README.md).

## The online demo

The online version is a read-only copy of the demo archive, so anyone can listen to it without installing anything. It runs from `demo/archive/`: the database and the audio of the demo's four recordings, kept in the repository. On Vercel, or with `COFRE_READ_ONLY=1`, Thread opens a working copy of that folder and refuses every change: nothing can be recorded, imported, renamed or removed, and search works by words only, because the models are not there. Recording and processing need Thread running on your own computer.

After reprocessing the demo locally, refresh the copy and try it the way it runs online:

```bash
npm run snapshot
npm run build
COFRE_READ_ONLY=1 npx next start
```

## Built with

Next.js, TypeScript, Tailwind CSS, SQLite (built into Node), whisper.cpp, Ollama, Gemma 4, EmbeddingGemma. Fonts: Newsreader, and Atkinson Hyperlegible Next and Mono, designed by the Braille Institute for readers with low vision.
