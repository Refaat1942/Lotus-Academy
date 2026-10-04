#!/usr/bin/env bash
# Project-scoped PostgreSQL backup (pg_dump -Fc) from the lotus-academy compose db service.
# Only files named lotus-academy-*.dump inside BACKUP_DIR are ever rotated; nothing else is touched.
set -euo pipefail
cd "$(dirname "$0")/.."
BACKUP_DIR="${BACKUP_DIR:-/opt/lotus-academy/backups}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"
mkdir -p "$BACKUP_DIR"; chmod 700 "$BACKUP_DIR"
set -a; [ -f .env ] && . ./.env; set +a
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT="$BACKUP_DIR/lotus-academy-$STAMP.dump"
docker compose -p lotus-academy exec -T db pg_dump -U "${POSTGRES_USER:-lotus}" -d "${POSTGRES_DB:-lotus_academy}" -Fc > "$OUT.partial"
mv "$OUT.partial" "$OUT"
# Verify: the archive must be readable and list tables.
docker compose -p lotus-academy exec -T db pg_restore --list < "$OUT" | grep -q 'TABLE DATA' || { echo "Backup verification FAILED: $OUT" >&2; exit 1; }
sha256sum "$OUT" > "$OUT.sha256"
find "$BACKUP_DIR" -maxdepth 1 -name 'lotus-academy-*.dump*' -mtime +"$RETAIN_DAYS" -delete
echo "Backup OK: $OUT ($(du -h "$OUT" | cut -f1))"
