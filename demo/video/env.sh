ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SNAPSHOT="$ROOT/demo/archive"
TMP="${TMPDIR:-/tmp}"
TAKE_DIR="${THREAD_DEMO_DIR:-${TMP%/}/thread-demo-take}"
TAKE_DIR="${TAKE_DIR%/}"
PORT="${THREAD_DEMO_PORT:-3210}"
MARK=".thread-demo-take"

listening() {
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1
}

fail() {
  echo "✗ $*" >&2
  exit 1
}
