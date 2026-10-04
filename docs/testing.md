# Testing

| Layer | Command | Covers |
|---|---|---|
| Unit | `npm test` | grading, completion, resume, certificate IDs, i18n parity, markdown sanitizing, CSV injection, date ranges, importer parsing/duplicates/zip safety |
| Integration (DB) | `bash scripts/test-db.sh && npm run test:int` | enrollment, server-side progress, certificate issuing (once), quiz grading/attempt limits, required-quiz gating, seeded RBAC |
| E2E | `npm run build && npm run test:e2e` | student journey (register→verify→login→enroll→lessons→quiz→certificate→public verify, password reset), admin journey (course/lesson CRUD, publish, reorder, reports, CSV), security suite |

`scripts/test-db.sh` only drops/recreates `lotus_academy_test`. E2E runs a production server on port 15170 against that DB.
Email delivery is not exercised end-to-end: tests plant known one-time tokens directly in the DB.
