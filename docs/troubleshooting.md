# Troubleshooting

| Symptom | Check |
|---|---|
| Page renders without styling | A stale server is running an old build; restart `next start` after every build |
| `Prisma failed to detect openssl` | Base image lacks OpenSSL; the provided Dockerfile installs it |
| Server action "Invalid Server Actions request" behind Nginx | Forward `Host` and `X-Forwarded-Host`; `APP_URL` must match the public origin |
| Verification/reset emails never arrive | *Admin → Emails*: status FAILED + error; set `SMTP_*` |
| "Too many attempts" | Rate limit/lockout (15 min); clear `RateLimit` rows or wait; unlock via `User.lockedUntil=NULL` |
| `/api/health/db` 503 | `docker compose -p lotus-academy logs db`; verify `POSTGRES_PASSWORD` unchanged since volume creation |
| Port 15169 in use | Do not kill the process; identify with `ss -ltnp`, report, pick another port |
| Imported quizzes are drafts | Source files contain only the correct answer; add options in *Admin → Quizzes* |
