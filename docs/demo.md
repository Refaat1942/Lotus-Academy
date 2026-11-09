# Demo data (for presentations)

```bash
# on the server
docker compose -p lotus-academy exec app npm run seed:demo
# remove it all afterwards
docker compose -p lotus-academy exec app npm run seed:demo -- --remove
```

Creates a fictional organisation: 4 areas, 13 branches, ~76 staff (pharmacists, branch/area/department managers)
with realistic training history — completed and overdue mandatory courses, ~1,300 quiz attempts and ~8,000 answers
(so *Learning insights* has data), certificates (one due for renewal, one expired), two new hires on an onboarding
path, and three weeks of question-of-the-day answers. It then runs the reminder job once.

Safety: every demo account uses the reserved domain `@demo.invalid` (no email is ever sent to it); the demo does
not change any course setting that would affect real staff (mandatory training is created only on demo accounts and
the demo path is not auto-assigned). `--remove` deletes the demo accounts and the demo path.

All demo accounts share the password `LotusDemo#2026` (override with `DEMO_PASSWORD=...`).

| Account | What to show |
|---|---|
| `branch.manager@demo.invalid` | *My team* — Zamalek branch: who is overdue, remind, drill into a person |
| `area.manager@demo.invalid` | *My team* — Cairo West: branches ranked by compliance |
| `dept.manager@demo.invalid` | *My team* — whole Retail Operations department |
| `pharmacist@demo.invalid` | Dashboard: certificate renewal, question of the day, streak, points; certificate design |
| `new.hire@demo.invalid` | Onboarding path: course 1 done, course 2 in progress, course 3 locked |
| your admin account | *Learning insights*, *Compliance*, *Learning paths*, *Notifications → reminders*, leaderboard |
