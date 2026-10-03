#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/demo/audio"

for script in "$ROOT"/demo/roteiros/*.txt; do
  name="$(basename "$script" .txt)"
  say -v Luciana -r 158 -f "$script" -o "$ROOT/demo/audio/$name.aiff"
  ffmpeg -loglevel error -y -i "$ROOT/demo/audio/$name.aiff" -ac 1 -c:a aac -b:a 96k "$ROOT/demo/audio/$name.m4a"
  rm "$ROOT/demo/audio/$name.aiff"
  echo "  ♪ $name.m4a"
done
