# Backups

`deploy/backup.sh` runs `pg_dump -Fc` inside the project's own `db` container, verifies the archive with `pg_restore --list`,
writes a `.sha256`, and rotates **only** `lotus-academy-*.dump*` files older than `RETAIN_DAYS` (default 14) in `BACKUP_DIR`
(default `/opt/lotus-academy/backups`, mode 700). Nothing outside that glob is ever deleted.

Schedule (project-scoped cron):
```
17 2 * * * cd /opt/lotus-academy && ./deploy/backup.sh >> /opt/lotus-academy/backups/backup.log 2>&1
```
Copy dumps off-server periodically (a backup on the same disk is not a disaster-recovery plan).
