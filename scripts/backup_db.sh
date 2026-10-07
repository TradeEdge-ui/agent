#!/usr/bin/env bash
# Backs up the local SQLite database to backend/backups/.
# Usage: ./scripts/backup_db.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/../backend"
DB_PATH="$BACKEND_DIR/data/app.db"
BACKUP_DIR="$BACKEND_DIR/backups"

if [ ! -f "$DB_PATH" ]; then
  echo "No database found at $DB_PATH -- nothing to back up."
  exit 1
fi

mkdir -p "$BACKUP_DIR"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
DEST="$BACKUP_DIR/app_${TIMESTAMP}.db"

# sqlite3 .backup is safer than a raw file copy while the app may be running,
# since it uses SQLite's own backup API instead of copying bytes mid-write.
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB_PATH" ".backup '$DEST'"
else
  cp "$DB_PATH" "$DEST"
fi

echo "Backup written to $DEST"
