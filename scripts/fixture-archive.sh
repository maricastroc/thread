#!/usr/bin/env bash
set -euo pipefail

FIXTURE="$(cd "${1:?usage: scripts/fixture-archive.sh <fixture-dir> [host]}" && pwd)"
HOST="${2:-http://localhost:3901}"
AUDIO="$FIXTURE/audio"
mkdir -p "$AUDIO"

while IFS=$'\t' read -r file voice recorded prompt; do
  name="$(basename "$file" .txt)"
  if [ ! -f "$AUDIO/$name.m4a" ]; then
    say -v "$voice" -r 150 -f "$FIXTURE/roteiros/$file" -o "$AUDIO/$name.aiff"
    ffmpeg -nostdin -loglevel error -y -i "$AUDIO/$name.aiff" -ac 1 -c:a aac -b:a 96k "$AUDIO/$name.m4a"
    rm "$AUDIO/$name.aiff"
  fi
done < "$FIXTURE/manifest.tsv"

curl -sf -X POST "$HOST/api/vault" -H 'content-type: application/json' -d @"$FIXTURE/vault.json" > /dev/null

while IFS=$'\t' read -r file voice recorded prompt; do
  name="$(basename "$file" .txt)"
  args=(-H 'content-type: audio/mp4' -H 'x-cofre-source: imported' -H "x-cofre-filename: $name.m4a" -H "x-cofre-recorded-at: $recorded")
  if [ -n "$prompt" ]; then
    args+=(-H "x-cofre-prompt: $(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$prompt")")
  fi
  curl -sf -X POST "$HOST/api/recordings" "${args[@]}" --data-binary @"$AUDIO/$name.m4a" > /dev/null
  echo "  ← $name"
done < "$FIXTURE/manifest.tsv"
