# Database

PostgreSQL 16, Prisma migrations (`prisma/migrations`). Apply with `npx prisma migrate deploy`.

Core groups: **identity** (User, Role, Permission, RolePermission, UserRole, Session, AuthToken, StudentProfile, InstructorProfile),
**catalog** (CourseCategory, Course, CourseModule, Lesson, LessonAsset, Video, Tag, CourseTag, CourseInstructor),
**learning** (Enrollment, LessonProgress, CourseProgress, Bookmark, Quiz, QuizQuestion, QuizOption, QuizAttempt, QuizAnswer, Certificate),
**ops** (Notification, EmailLog, AuditLog, SystemSetting, RateLimit, ImportBatch, ImportArchive).

Conventions: cuid primary keys; `createdAt/updatedAt`; soft delete via `deletedAt` on User/Course/Lesson;
unique constraints on `(userId, courseId)`, `(userId, lessonId)`, `Certificate.publicId`, `Course.code`, `Lesson.code`;
indexes on status/date filters. Tokens and sessions are stored as SHA-256 hashes only.

Course/lesson rows imported from ZIPs carry provenance: `sourceArchive`, `sourcePath`, `sourceHash`, `importedAt`.
