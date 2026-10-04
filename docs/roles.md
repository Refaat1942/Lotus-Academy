# Roles & permissions

Permissions (`src/lib/permissions.ts`): `users.read/write`, `roles.write`, `courses.read/write/publish`, `lessons.write`, `quizzes.write`,
`enrollments.read/write`, `certificates.read/write`, `reports.read`, `settings.write`, `audit.read`, `emails.read`.

| Role | Grants |
|---|---|
| SUPER_ADMIN | everything incl. `roles.write` (only role that can grant/revoke roles) |
| ADMIN | everything except `roles.write` |
| CONTENT_MANAGER | courses r/w/publish, lessons, quizzes |
| INSTRUCTOR | courses r/w, lessons, quizzes — only for courses they are assigned to (no publish, no learner data) |
| SUPPORT | read-only: users, courses, enrollments, certificates, emails |
| STUDENT | none (learner area only) |

Every server action calls `assertPermission`; pages call `requirePermission`; the CSV API checks per export type.
Role changes force the target to re-login. An ADMIN cannot suspend a SUPER_ADMIN; nobody can change their own status.
