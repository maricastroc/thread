# Pauses: rhythm fixtures

Recordings used to check the pause evidence that Thread measures in the audio and hands to the interpreter. A pause is measured on the recording's own sound envelope, against the recording's own levels, and it becomes a cue only when it is clearly longer than the speaker's usual pause between sentences. Nothing here may be used as a rule in the code: the fixtures only exercise the general rule, and the names and places in them appear in no other recording.

The tests read the derived evidence committed here (`*.json`: the envelope at 20 values per second and Whisper's sentences with word timings), so they run without `say`, ffmpeg or Whisper. The audio itself stays out of the repository.

```bash
node --experimental-transform-types --no-warnings --import ./test/register.mjs scripts/pause-fixtures.ts
node --experimental-transform-types --no-warnings --import ./test/register.mjs scripts/pause-fixtures.ts --archive data <recording-id> human-fortaleza
```

The first command reads each script in `roteiros/` with the macOS voice and rate in `manifest.tsv` and runs the result through the same conversion, analysis and transcription as any recording. The second exports the evidence of a recording already in an archive: `human-fortaleza.json` is the demo's human reading of `demo/roteiros/03-fortaleza.txt`, exactly as the archive transcribed it.

The structural tests ask the interpreter (Gemma through Ollama) to divide each recording, so they only run when asked:

```bash
COFRE_MODEL_TESTS=1 npm test
```

## Expected behaviour, written before the first run

| fixture | what it exercises | acoustic evidence | structure |
|---|---|---|---|
| `fast-speech` | Fast speech: ordinary pauses well under half a second; the change of subject is followed by a pause of about one second, far below the old fixed 2.5 s | a cue before "Com dezoito anos" and nowhere else | a new story starts at "Com dezoito anos" and nowhere else |
| `slow-speech` | Slow speech: ordinary pauses of about two seconds, some above the old fixed 2.5 s; the change of subject has a pause about twice as long | a cue before "Em setenta e dois" and nowhere else; the ordinary two-second pauses are not cues | a new story starts at "Em setenta e dois" and nowhere else |
| `same-subject-pause` | A long pause for emphasis in the middle of one memory | a cue before "Era erva-doce" | one story: the pause does not split it |
| `subject-change` | A clear change of subject marked by a pause only moderately longer than usual | a cue before "Já adulta" | a new story starts at "Já adulta" and nowhere else |
| `human-fortaleza` | Natural speech whose Whisper timestamps drift away from the real silences | the silences at about 34.0–35.8 s, 60.5–62.3 s and 92.8–94.3 s are found and become cues before "A primeira casa", "Então, pra ajudar" and "E é isso"; the 1.1 s pause before "O Marcos", inside the same memory, is not a cue | the arrival by the sea and the sewing are never in the same story; the division does not change when the narrator's name changes |

The silences in `human-fortaleza` were measured in the investigation of that recording, before this rule existed.
