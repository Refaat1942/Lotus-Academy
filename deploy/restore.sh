#!/usr/bin/env bash
# Restore a backup INTO the lotus-academy database. Destructive for that database only; requires explicit confirmation.
# Usage: deploy/restore.sh /opt/lotus-academy/backups/lotus-academy-XXXX.dump
set -euo pipefail
cd "$(dirname "$0")/.."
FILE="${1:?usage: restore.sh <backup.dump>}"
[ -f "$FILE" ] || { echo "No such file: $FILE" >&2; exit 1; }
[ -f "$FILE.sha256" ] && sha256sum -c "$FILE.sha256"
set -a; [ -f .env ] && . ./.env; set +a
DB="${POSTGRES_DB:-lotus_academy}"; USR="${POSTGRES_USER:-lotus}"
if [ "${CONFIRM_RESTORE:-}" != "yes" ]; then
  echo "This REPLACES all data in database '$DB' (project lotus-academy). Re-run with CONFIRM_RESTORE=yes to proceed." >&2; exit 2
fi
docker compose -p lotus-academy stop app
docker compose -p lotus-academy exec -T db pg_restore -U "$USR" -d "$DB" --clean --if-exists --no-owner < "$FILE"
docker compose -p lotus-academy start app
echo "Restore complete. Check: curl -fsS http://127.0.0.1:15169/api/health/db"
