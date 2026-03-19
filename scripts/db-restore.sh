#!/usr/bin/env bash
set -euo pipefail

# Database restore script for Orion
# Usage: ./scripts/db-restore.sh <backup_file>

if [ $# -eq 0 ]; then
  echo "Usage: $0 <backup_file>"
  echo "Available backups:"
  ls -la backups/*.dump 2>/dev/null || echo "  No backups found in backups/"
  exit 1
fi

BACKUP_FILE="$1"
DATABASE_URL="${DATABASE_URL:-postgresql://orion:orion@localhost:5432/orion}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Parse DATABASE_URL
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')

echo "==> WARNING: This will restore $BACKUP_FILE to $DB_NAME@$DB_HOST:$DB_PORT"
echo "    This is a DESTRUCTIVE operation that will overwrite existing data."
read -p "    Continue? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo "==> Restoring from $BACKUP_FILE..."
PGPASSWORD=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p') \
  pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --clean --if-exists --no-owner --no-privileges \
    "$BACKUP_FILE"

echo "==> Restore complete."
