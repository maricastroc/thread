#!/usr/bin/env bash
set -euo pipefail

HOST="${1:-http://localhost:3000}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AUDIO="$ROOT/demo/audio"

if [ ! -d "$AUDIO" ] || [ -z "$(ls -A "$AUDIO" 2>/dev/null)" ]; then
  "$ROOT/scripts/demo-audio.sh"
fi

curl -sf -X POST "$HOST/api/vault" -H 'content-type: application/json' \
  -d '{"narrator":"Lúcia","birthYear":1948,"language":"pt"}' > /dev/null

day=21
for file in "$AUDIO"/*.m4a; do
  name="$(basename "$file")"
  curl -sf -X POST "$HOST/api/recordings" \
    -H 'content-type: audio/mp4' \
    -H 'x-cofre-source: imported' \
    -H "x-cofre-filename: $name" \
    -H "x-cofre-recorded-at: 2026-09-${day}T15:00:00Z" \
    --data-binary @"$file"
  echo "  ← $name"
  day=$((day + 3))
done
