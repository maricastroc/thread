# Demo video tooling

Tooling for filming the Thread demo video. It is not part of the product: nothing here is imported by the app, and the app runs unchanged.

A take starts from a disposable copy of the official snapshot (`demo/archive/`, four recordings), imports the fifth recording through the real interface, waits for the real pipeline (ffmpeg, whisper.cpp, Gemma, provenance checks, indexing) and walks through the result. The snapshot, `data/` and any other Thread you have running are never touched.

## Once

```bash
cd demo/video
npm install
```

The take drives the Google Chrome installed on the Mac (it plays the AAC audio the archive serves), so no browser is downloaded.

## Every take

Three terminals, from `demo/video/`.

1. Ollama, if it is not already running:

   ```bash
   ollama serve
   ```

2. Reset the take to the four recordings, then start Thread on it:

   ```bash
   npm run reset
   npm run serve
   ```

   `reset` copies `demo/archive/` to `$TMPDIR/thread-demo-take`, replacing the previous take. It refuses to run while anything serves on the take port or still has a file of the take open, and it only removes a folder it created itself (marked with `.thread-demo-take`).

   `serve` checks Ollama, the Gemma and EmbeddingGemma models, whisper.cpp, ffmpeg and the Whisper models, builds Thread if the source is newer than the last build, and runs `next start` on port 3210 with `COFRE_DATA_DIR` pointing at the take. Stop it with Ctrl+C before the next reset.

3. Run the take:

   ```bash
   npm run take
   ```

   It prints a timeline with the time of every step, which helps when editing, and the screen region to capture.

## What a take does

| step | on screen |
|---|---|
| 1 | Life, 5 s |
| 2 | Opens “Chegada a Fortaleza e visão do mar” from its mark on the lifeline, then “Read what was said”; plays the quote (about 7 s of the original voice) and pauses |
| 3 | People → José: four stories, 1966 to 2010, joined on the lifeline |
| 4 | Recordings, checked to show exactly 4 |
| 5 | Add a story → Import a recording → the fifth file |
| 6 | The real processing screen, until the recording is ready |
| 7 | What the archive found in it, then the richest new story |
| 8 | Plays the new story’s quote, about 7 s, and pauses |
| 9 | In this story, with “How to read the notes” opened |
| 10 | Clicks the time of one note in the transcript (a date taken from the words or said, otherwise a place or a person) and lets the voice play from there, about 5.5 s |
| 11 | Life, then the new story’s mark, 5 s |

About 2 min 25 s, of which about 65 s is processing. The take ends with a check that Recordings shows 5.

It stops with a clear message, and changes nothing, when the archive does not start with exactly 4 recordings, when the fifth file is already in it, when Thread is read-only or not running, when processing fails or finds no story, or when the audio does not play from where it should.

## Options

Each one is a flag or an environment variable.

| flag | variable | default |
|---|---|---|
| `--audio <path>` | `THREAD_DEMO_AUDIO` | `~/Desktop/hackaton/audios-tratados/05-volta-quixada.m4a` |
| `--viewport auto\|WxH` | `THREAD_DEMO_VIEWPORT` | `auto`: 1440×810 if it fits on the screen, otherwise 1280×720 |
| `--color-scheme dark\|light` | `THREAD_DEMO_COLOR_SCHEME` | `dark` |
| `--opening-story <title>` | `THREAD_DEMO_OPENING_STORY` | `Chegada a Fortaleza e visão do mar` |
| `--person <name>` | `THREAD_DEMO_PERSON` | `José` |
| `--evidence <name>` | `THREAD_DEMO_EVIDENCE` | chosen by the rule in step 10, e.g. `--evidence Graça` |
| `--processing-timeout <minutes>` | `THREAD_DEMO_PROCESSING_MINUTES` | `20` |
| `--keep-open` | `THREAD_DEMO_KEEP_OPEN=1` | closes the browser 5 s after the last step |
| `--take-dir <path>` | `THREAD_DEMO_DIR` | `$TMPDIR/thread-demo-take` (also read by `reset` and `serve`) |
| | `THREAD_DEMO_PORT` | `3210` |

Example: `npm run take -- --evidence Graça --keep-open`.

## Capturing

The browser window is sized so that the page itself is exactly 16:9, without emulation. With the Dock visible on a 1440×932 screen the page is 1280×720 points (2560×1440 pixels on Retina); with the Dock hidden it is 1440×810 (2880×1620). Capture the region the take prints (for example `x 0, y 116, 1280 × 720`), or the whole screen and crop to it while editing.

Move the pointer off the window before starting, and capture system audio (OBS, or QuickTime with an audio loopback device): the voice comes from Thread’s own player.
