# Course import

Source: ZIP archives in `content/sources/` (`courses/NN-slug/course-overview.md`, `courses/NN-slug/lessons/lesson-NN-*.md`;
the redundant `full-curriculum/` export is ignored). Run: `npm run import:courses [dir]` (also on container start unless `IMPORT_ON_START=false`).

Pipeline: read ZIP in memory (never extracted to disk; entries with `..`/absolute paths rejected; only `.md` kept; size/entry limits)
→ SHA-256 of archive + content hash of the `courses/` tree → duplicate detection (same bytes **or** same content) →
parse overview/lessons (IDs, duration, objectives, body, embedded quiz) → upsert by `Course.code` / `Lesson.code` in one transaction
→ `ImportBatch`/`ImportArchive` report. Re-running is a no-op (`unchanged`) when the course hash matches.

* One module "Course lessons" is created per course (sources have no module level); admins can restructure.
* Lesson Markdown is stored canonically in `Lesson.bodyMd` and sanitized at render time.
* **Quizzes**: sources embed 10 questions/lesson. Only questions with ≥2 options and a marked answer are usable. A quiz is published when
  ≥5 usable questions exist; otherwise it stays `DRAFT` with all source questions preserved so admins can add distractors in
  *Admin → Quizzes* (publishing is blocked until each question has ≥2 options and a correct answer).
* Re-import overwrites imported fields of changed courses/lessons (source of truth = archive); lessons absent from a changed archive are archived.
* Course 06 does not exist in the supplied sources; `Course-07-pediatrics (1).zip` was not received (only one pediatrics archive was uploaded).
