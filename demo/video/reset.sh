#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/env.sh"

[ -f "$SNAPSHOT/cofre.db" ] || fail "Snapshot not found at $SNAPSHOT"
if listening; then
  fail "Something is serving on port $PORT. Stop the take server (Ctrl+C in its terminal) before resetting."
fi
if [ -d "$TAKE_DIR" ]; then
  holders="$(lsof -t +D "$TAKE_DIR" 2>/dev/null || true)"
  [ -z "$holders" ] || fail "Processes still have the take open (pid $(echo $holders)). Stop the take server before resetting."
fi

snapshot_count="$(sqlite3 -readonly "$SNAPSHOT/cofre.db" "SELECT COUNT(*) FROM recordings")"
[ "$snapshot_count" = "4" ] || fail "The snapshot has $snapshot_count recordings, expected 4. Nothing was changed."
snapshot_sum="$(find "$SNAPSHOT" -type f -exec shasum -a 256 {} + | sort | shasum -a 256)"

if [ -e "$TAKE_DIR" ]; then
  [ -f "$TAKE_DIR/$MARK" ] || fail "$TAKE_DIR exists but is not a demo take (no $MARK). Refusing to remove it."
  previous="$(sqlite3 -readonly "$TAKE_DIR/cofre.db" "SELECT COUNT(*) FROM recordings" 2>/dev/null || echo "?")"
  echo "  removing the previous take at $TAKE_DIR ($previous recordings)"
  rm -rf "$TAKE_DIR"
fi

mkdir -p "$TAKE_DIR"
cp -R "$SNAPSHOT/." "$TAKE_DIR/"
chmod -R u+w "$TAKE_DIR"
date -u +%Y-%m-%dT%H:%M:%SZ > "$TAKE_DIR/$MARK"

[ "$(find "$SNAPSHOT" -type f -exec shasum -a 256 {} + | sort | shasum -a 256)" = "$snapshot_sum" ] || fail "The snapshot changed while copying it."
take_count="$(sqlite3 -readonly "$TAKE_DIR/cofre.db" "SELECT COUNT(*) FROM recordings")"
[ "$take_count" = "4" ] || fail "The new take has $take_count recordings, expected 4."

echo "✓ fresh take with 4 recordings at $TAKE_DIR"
sqlite3 -readonly "$TAKE_DIR/cofre.db" "SELECT '    ' || original_name FROM recordings ORDER BY recorded_at"
