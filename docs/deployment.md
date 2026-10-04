# Deployment (Ubuntu 24.04, shared Hostinger VPS)

This VPS hosts other applications. Everything is project-scoped (`docker compose -p lotus-academy`, dedicated network/volume names).
**Never** run global prune/cleanup, stop unknown containers, or edit existing Nginx sites.

## 0. Read-only inspection (run first, paste the output to the team)
```bash
free -h; nproc; df -h /; docker --version; docker compose version; nginx -v
docker ps --format '{{.Names}}\t{{.Ports}}'
ss -ltnp | grep -E ':15169\b' || echo "15169 is free"
ls /etc/nginx/sites-enabled/
```
If `15169` is occupied, **stop** and identify the owner (`ss -ltnp`, `docker ps`); do not kill it — choose another port with the owner's approval.

## 1. Install
```bash
sudo mkdir -p /opt/lotus-academy && sudo chown $USER /opt/lotus-academy
git clone <repo> /opt/lotus-academy && cd /opt/lotus-academy
cp .env.production.example .env && chmod 600 .env && nano .env      # real secrets, APP_URL, SMTP
docker compose -p lotus-academy up -d --build
docker compose -p lotus-academy ps
curl -fsS http://127.0.0.1:15169/api/health/db
docker compose -p lotus-academy exec -e ADMIN_EMAIL=admin@yourdomain -e ADMIN_PASSWORD='<strong>' app npx tsx scripts/create-admin.ts
```
The app binds to `127.0.0.1:15169` only; PostgreSQL has no published port.

## 2. Nginx (only if a domain is ready)
Copy `deploy/nginx-lotus-academy.conf` to a **new** file, set `server_name`, `sudo nginx -t`, then `sudo systemctl reload nginx`;
add HTTPS with `sudo certbot --nginx -d <domain>`. Keep `X-Forwarded-Host`/`X-Real-IP` headers (needed for server actions + rate limiting).

## 3. Backups & updates
Install the cron in [backups.md](backups.md). Update: `git pull && docker compose -p lotus-academy up -d --build` (migrations + idempotent seed/import run on start).
