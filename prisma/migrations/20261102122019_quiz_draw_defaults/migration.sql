-- Default assessment policy: lesson quizzes serve 5 random questions per attempt;
-- course final exams serve 20 random questions with at most 3 attempts (admins can change both per quiz).
UPDATE "Quiz" SET "drawCount" = 5 WHERE "lessonId" IS NOT NULL AND "drawCount" = 0;
UPDATE "Quiz" SET "drawCount" = 20, "maxAttempts" = 3 WHERE "lessonId" IS NULL AND "drawCount" = 0;
