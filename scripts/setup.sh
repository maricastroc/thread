#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

missing=0
need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "✗ $1 is missing. $2"
    missing=1
  else
    echo "✓ $1"
  fi
}

need ffmpeg "macOS: brew install ffmpeg · Debian/Ubuntu: sudo apt install ffmpeg"
need whisper-cli "macOS: brew install whisper-cpp · elsewhere: build from https://github.com/ggml-org/whisper.cpp"
need ollama "macOS: brew install ollama · elsewhere: https://ollama.com/download"
if [ "$missing" = "1" ]; then
  echo
  echo "Install the missing tools above, then run npm run setup again."
  exit 1
fi

mkdir -p models
fetch() {
  local file="$1" url="$2"
  if [ -f "models/$file" ]; then
    echo "✓ models/$file"
  else
    echo "↓ models/$file"
    curl -L --fail --retry 3 -C - -o "models/$file.part" "$url"
    mv "models/$file.part" "models/$file"
  fi
}

fetch ggml-large-v3-turbo-q8_0.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q8_0.bin
fetch ggml-silero-v6.2.0.bin https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v6.2.0.bin

if ! curl -sf "${OLLAMA_HOST:-http://127.0.0.1:11434}/api/version" >/dev/null; then
  echo
  echo "Ollama is not running. Start it in another terminal with: ollama serve"
  echo "Then run npm run setup again to download the Gemma models."
  exit 1
fi

ollama pull "${COFRE_INTERPRETER_MODEL:-gemma4:e4b}"
ollama pull "${COFRE_EMBEDDING_MODEL:-embeddinggemma}"

echo
echo "Ready. Start the archive with: npm run dev"
