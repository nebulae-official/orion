#!/usr/bin/env bash
set -euo pipefail

# Database migration script for Orion
# Usage: ./scripts/db-migrate.sh [--dry-run]

DRY_RUN=false
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=true
fi

echo "==> Current migration revision:"
uv run alembic current 2>/dev/null || echo "  (no revision — database may be empty)"

if [ "$DRY_RUN" = true ]; then
  echo ""
  echo "==> Dry run — SQL that would be executed:"
  uv run alembic upgrade head --sql
else
  echo ""
  echo "==> Running migrations..."
  uv run alembic upgrade head
  echo ""
  echo "==> New revision:"
  uv run alembic current
  echo "==> Migration complete."
fi
