#!/usr/bin/env bash
# Recreates ONLY the isolated test database (lotus_academy_test), migrates, seeds roles, imports the curriculum.
set -euo pipefail
export PGPASSWORD="${PGPASSWORD:-lotus_dev_pw}"
HOST="${PGHOST:-localhost}"; USER_="${PGUSER:-lotus}"
psql -h "$HOST" -U "$USER_" -d postgres -v ON_ERROR_STOP=1 -q -c 'DROP DATABASE IF EXISTS lotus_academy_test' -c 'CREATE DATABASE lotus_academy_test'
export DATABASE_URL="${TEST_DATABASE_URL:-postgresql://$USER_:$PGPASSWORD@$HOST:5432/lotus_academy_test?schema=public}"
npx prisma migrate deploy >/dev/null
npx tsx prisma/seed.ts
npx tsx scripts/import-courses.ts >/dev/null
echo "Test DB ready"
