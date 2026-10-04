# Restore

```bash
cd /opt/lotus-academy
ls backups/                                    # pick a dump
CONFIRM_RESTORE=yes ./deploy/restore.sh backups/lotus-academy-<stamp>.dump
curl -fsS http://127.0.0.1:15169/api/health/db
```
The script verifies the checksum, stops only the `app` service, restores into the `lotus_academy` database (`--clean --if-exists`),
and restarts the app. It refuses to run without `CONFIRM_RESTORE=yes`. Rehearse on a copy first when possible.
