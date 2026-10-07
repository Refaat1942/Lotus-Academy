# Lotus Academy — أكاديمية لوتس

Learning management platform for pharmacists (Next.js 15 · TypeScript · Tailwind · Prisma · PostgreSQL).
Bilingual (English LTR / Arabic RTL). Port **15169**.

> **Brand status:** the official lotusonline.com logo/palette could not be fetched during the build
> (egress blocked). `public/brand/lotus-mark.svg` and the tokens in `src/app/globals.css` are
> **provisional** — see [docs/architecture.md](docs/architecture.md#brand).

## Quick start (local)

```bash
cp .env.example .env            # set DATABASE_URL
npm ci
npx prisma migrate deploy       # create schema
npm run db:seed                 # roles, permissions, settings
npm run import:courses          # imports content/sources/*.zip (idempotent)
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='LongPassw0rd!' npm run create:admin
npm run dev                     # http://localhost:15169
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run build` / `npm start` | Production build / server (port 15169) |
| `npm test` | Unit tests (Vitest, no DB) |
| `bash scripts/test-db.sh && npm run test:int` | Recreate isolated test DB + DB integration tests |
| `npm run test:e2e` | Playwright E2E + security tests (needs test DB + a build) |
| `npm run import:courses [dir]` | Import ZIP curricula, prints a JSON report |
| `npm run validate:course -- <folder>` | Validate an authored bilingual course folder (structure, quizzes, EN/AR parity, no personal names) |
| `npm run pack:courses` | Pack `content/courses-src/NN-*` folders into `content/sources/*.zip` |
| `npm run create:admin` | Create/refresh a SUPER_ADMIN (`--role ADMIN` for others) |

## Documentation

[architecture](docs/architecture.md) · [database](docs/database.md) · [authentication](docs/authentication.md) ·
[roles](docs/roles.md) · [course-import](docs/course-import.md) · [environment](docs/environment.md) ·
[deployment](docs/deployment.md) · [backups](docs/backups.md) · [restore](docs/restore.md) ·
[content-verification](docs/content-verification.md) · [learning-experience](docs/learning-experience.md) · [testing](docs/testing.md) · [security](docs/security.md) · [troubleshooting](docs/troubleshooting.md)
