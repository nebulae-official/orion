#!/usr/bin/env bash
set -euo pipefail

# Database backup script for Orion
# Usage: ./scripts/db-backup.sh [output_dir]

BACKUP_DIR="${1:-backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/orion_${TIMESTAMP}.dump"
DATABASE_URL="${DATABASE_URL:-postgresql://orion:orion@localhost:5432/orion}"

# Parse DATABASE_URL
# Format: postgresql://user:pass@host:port/dbname
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')

mkdir -p "$BACKUP_DIR"

echo "==> Backing up $DB_NAME@$DB_HOST:$DB_PORT"
echo "    Output: $BACKUP_FILE"

PGPASSWORD=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p') \
  pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -Fc --no-owner --no-privileges \
    -f "$BACKUP_FILE"

SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "==> Backup complete: $BACKUP_FILE ($SIZE)"
