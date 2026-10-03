# Dense archive: density fixture

A third isolated archive used to check that the lifeline stays legible with many more stories and names than the demo: 60 short stories in 6 recordings, 60 people and 30 places, a few of them recurring in a dozen stories, dates from 1938 to 2023 with most of them packed into the narrator's childhood and youth. The stories are generated from a fixed seed by `scripts/dense-fixture.mjs`, read by the macOS "Grandma" pt-BR voice, and go through the whole pipeline like any recording.

```bash
node scripts/dense-fixture.mjs fixtures/dense-archive
COFRE_DATA_DIR=/tmp/cofre-dense npx next start -p 3902
./scripts/fixture-archive.sh fixtures/dense-archive http://localhost:3902
```

The text is deliberately repetitive, so the archive tests layout and density, not the quality of the interpretation.
