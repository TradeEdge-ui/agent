#!/usr/bin/env bash
# Restores the local SQLite database from a backup file.
# Usage: ./scripts/restore_db.sh backend/backups/app_20250101_120000.db
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/../backend"
DB_PATH="$BACKEND_DIR/data/app.db"

if [ $# -ne 1 ]; then
  echo "Usage: $0 <path-to-backup.db>"
  exit 1
fi

BACKUP_FILE="$1"
if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "This will REPLACE the current database at $DB_PATH."
read -p "Stop the backend server first, then type 'yes' to continue: " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 1
fi

mkdir -p "$BACKEND_DIR/data"
cp "$BACKUP_FILE" "$DB_PATH"
echo "Database restored from $BACKUP_FILE"
