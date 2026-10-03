#!/usr/bin/env bash
set -euo pipefail

HOST="${1:-http://localhost:3000}"
FROM="${2:-organizing}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

for id in $(sqlite3 "$ROOT/data/cofre.db" "SELECT id FROM recordings ORDER BY recorded_at"); do
  curl -sf -X POST "$HOST/api/recordings/$id/reprocess" -H 'content-type: application/json' -d "{\"from\":\"$FROM\"}"
  echo "  ↻ $id"
done
