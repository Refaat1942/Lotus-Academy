#!/bin/sh
set -e
# Apply pending migrations and (idempotently) seed roles/permissions and the curriculum on every start.
npx prisma migrate deploy
npx tsx prisma/seed.ts
if [ "${IMPORT_ON_START:-true}" = "true" ]; then npx tsx scripts/import-courses.ts >/dev/null; fi
exec "$@"
