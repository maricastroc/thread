#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/env.sh"

[ -f "$TAKE_DIR/$MARK" ] || fail "No demo take at $TAKE_DIR. Run the reset first."
listening && fail "Port $PORT is already in use."

OLLAMA="${OLLAMA_HOST:-http://127.0.0.1:11434}"
[[ "$OLLAMA" == http* ]] || OLLAMA="http://$OLLAMA"
tags="$(curl -sf -m 5 "$OLLAMA/api/tags")" || fail "Ollama is not answering at $OLLAMA. Start it with: ollama serve"
for model in "${COFRE_INTERPRETER_MODEL:-gemma4:e4b}" "${COFRE_EMBEDDING_MODEL:-embeddinggemma}"; do
  grep -q "\"name\":\"$model\(:latest\)\?\"" <<<"$tags" || fail "Ollama has no $model. Run: npm run setup"
done
command -v "${COFRE_WHISPER_BIN:-whisper-cli}" >/dev/null || fail "whisper-cli not found. Run: brew install whisper-cpp"
command -v "${COFRE_FFMPEG_BIN:-ffmpeg}" >/dev/null || fail "ffmpeg not found. Run: brew install ffmpeg"
for model in "${COFRE_WHISPER_MODEL:-models/ggml-large-v3-turbo-q8_0.bin}" "${COFRE_VAD_MODEL:-models/ggml-silero-v6.2.0.bin}"; do
  [ -f "$ROOT/$model" ] || [ -f "$model" ] || fail "Missing $model. Run: npm run setup"
done

cd "$ROOT"
if [ ! -f .next/BUILD_ID ] || [ -n "$(find src public next.config.ts package.json -newer .next/BUILD_ID 2>/dev/null | head -1)" ]; then
  echo "  building Thread (the source is newer than the last build)"
  npx next build
fi

unset COFRE_READ_ONLY VERCEL
export COFRE_DATA_DIR="$TAKE_DIR"
echo "  Thread for the demo take: http://localhost:$PORT  (archive: $TAKE_DIR)"
exec npx next start -p "$PORT"
