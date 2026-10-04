# Architecture

```
Browser ── Nginx (TLS) ── Next.js app :15169 ── PostgreSQL (private Docker network)
                              │
                              ├─ Server components / server actions (all authorization server-side)
                              ├─ Prisma ORM (migrations in prisma/migrations)
                              ├─ SMTP (nodemailer) → EmailLog
                              └─ Content importer (ZIP → DB), run at deploy or on demand
```

* **Single deployable**: Next.js App Router renders pages and exposes the few HTTP routes (`/api/health`, `/api/health/db`, CSV export).
  Mutations are server actions; each re-checks the session and permission (`assertPermission`).
* **Domain logic** is pure and unit-tested (`src/lib/domain.ts`): quiz grading, completion, resume position.
  `src/lib/learning.ts` orchestrates it with the database (enrollment → progress → certificate).
* **i18n**: dictionaries in `src/i18n/{en,ar}.ts` (a test enforces key parity); locale cookie `la_locale`; `<html dir>` flips RTL.
  Bilingual DB fields (`titleEn`/`titleAr`) fall back to English.
* **Design tokens**: CSS variables in `src/app/globals.css` → Tailwind theme (`primary`, `primary-dark`, `primary-light`, `secondary`, `background`, `surface`, `text`, `muted`, `border`, `success`, `warning`, `error`). No raw colors elsewhere.

## Brand
The official Lotus assets were unreachable at build time. To apply them: replace `public/brand/lotus-mark.svg`
and `public/favicon.svg` (same names) and edit the token values in `globals.css`. Certificates and emails
inherit the same assets/tokens (email HTML in `src/lib/mail.ts` uses the primary hex — update there too).

## Extension points (not implemented, designed for)
`Course.priceCents/currency` and `Enrollment.source` (payments, promo codes, organisations);
`Video.provider` (Zoom/live sessions can add a provider); `Notification.type` (forums/messaging);
`SystemSetting` (feature flags); `Lesson.searchText` (move to a `tsvector` GIN index for full-text search).
