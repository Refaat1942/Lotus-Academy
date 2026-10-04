# Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL URL (compose builds it from `POSTGRES_*`) |
| `APP_URL` | yes | Public base URL; `https://` enables `Secure` cookies and HSTS-consistent links |
| `POSTGRES_PASSWORD` | compose | Long random; DB is not published |
| `SMTP_HOST/PORT/USER/PASS/FROM` | for email | Without `SMTP_HOST` emails are recorded as FAILED ("SMTP not configured") |
| `ANTHROPIC_API_KEY` | for AI assistant | Enables the trainee study assistant (Claude). Unset = keyword-search fallback over the lesson text |
| `ASSISTANT_MODEL` | no | Defaults to `claude-opus-5-5`; set `claude-sonnet-5-5` for lower cost |
| `BIND_ADDR` | no | `127.0.0.1` (default, behind Nginx) or `0.0.0.0` to expose `http://SERVER_IP:15169` directly |
| `IMPORT_ON_START` | no | `true` (default) re-runs the idempotent import on container start |

Secrets live only in `.env` on the server (chmod 600, git-ignored). `.env.production.example` is the template.
