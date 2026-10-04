import { db } from "./db";
import { audit } from "./audit";
import { computeCompletion, gradeQuiz, attemptsRemaining, buildCheckpointPool, drawCheckpoint, type PoolQuestion } from "./domain";
import { newCertificateId } from "./tokens";
import { sendMail } from "./mail";
import { env } from "./env";

export const publishedLessonsWhere = (courseId: string) => ({ courseId, status: "PUBLISHED" as const, deletedAt: null });

export async function enroll(userId: string, courseId: string) {
  const course = await db.course.findFirst({ where: { id: courseId, status: "PUBLISHED", deletedAt: null } });
  if (!course) throw new Error("Course not available");
  const existing = await db.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
  if (existing) {
    if (existing.status === "CANCELLED") await db.enrollment.update({ where: { id: existing.id }, data: { status: "ACTIVE" } });
    return existing;
  }
  const total = await db.lesson.count({ where: publishedLessonsWhere(courseId) });
  const e = await db.$transaction(async (tx) => {
    const created = await tx.enrollment.create({ data: { userId, courseId } });
    await tx.courseProgress.upsert({ where: { userId_courseId: { userId, courseId } }, update: {}, create: { userId, courseId, lessonsTotal: total } });
    await tx.notification.create({ data: { userId, type: "enrollment", title: `Enrolled in ${course.titleEn}`, href: `/courses/${course.slug}` } });
    return created;
  });
  const user = await db.user.findUnique({ where: { id: userId } });
  if (user) void sendMail(user.email, "enrollment_confirmation", { name: user.firstName, course: course.titleEn, url: `${env.appUrl()}/courses/${course.slug}` });
  return e;
}

async function requireActiveEnrollment(userId: string, courseId: string) {
  const e = await db.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
  if (!e || e.status === "CANCELLED") throw new Error("Not enrolled");
  return e;
}

/** Recomputes progress from the database (never trusts the client) and issues the certificate when eligible. */
export async function recomputeCourse(userId: string, courseId: string) {
  const lessons = await db.lesson.findMany({ where: publishedLessonsWhere(courseId), select: { id: true } });
  const done = await db.lessonProgress.findMany({ where: { userId, courseId, completedAt: { not: null } }, select: { lessonId: true } });
  const quizzes = await db.quiz.findMany({
    where: { courseId, status: "PUBLISHED", required: true },
    select: { id: true, attempts: { where: { userId, passed: true }, select: { id: true }, take: 1 } },
  });
  const c = computeCompletion({
    publishedLessonIds: lessons.map((l) => l.id),
    completedLessonIds: new Set(done.map((d) => d.lessonId)),
    requiredQuizzes: quizzes.map((q) => ({ id: q.id, passed: q.attempts.length > 0 })),
  });
  await db.courseProgress.upsert({
    where: { userId_courseId: { userId, courseId } },
    update: { percent: c.percent, lessonsDone: c.done, lessonsTotal: c.total },
    create: { userId, courseId, percent: c.percent, lessonsDone: c.done, lessonsTotal: c.total },
  });
  if (c.complete) await completeCourse(userId, courseId);
  return c;
}

async function completeCourse(userId: string, courseId: string) {
  const enrollment = await db.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
  if (!enrollment || enrollment.status === "COMPLETED") return;
  const [user, course] = await Promise.all([db.user.findUniqueOrThrow({ where: { id: userId } }), db.course.findUniqueOrThrow({ where: { id: courseId } })]);
  const cert = await db.$transaction(async (tx) => {
    await tx.enrollment.update({ where: { id: enrollment.id }, data: { status: "COMPLETED", completedAt: new Date() } });
    const existing = await tx.certificate.findUnique({ where: { userId_courseId: { userId, courseId } } });
    if (existing) return existing;
    const c = await tx.certificate.create({
      data: { publicId: newCertificateId(), userId, courseId, recipientName: `${user.firstName} ${user.lastName}`.trim(), courseTitle: course.titleEn },
    });
    await tx.notification.create({ data: { userId, type: "certificate", title: `Certificate ready: ${course.titleEn}`, href: `/certificates/${c.publicId}` } });
    return c;
  });
  await audit(userId, "course.completed", "Course", courseId);
  void sendMail(user.email, "course_completion", { name: user.firstName, course: course.titleEn, url: `${env.appUrl()}/dashboard` });
  void sendMail(user.email, "certificate_ready", { name: user.firstName, course: course.titleEn, certificateId: cert.publicId, url: `${env.appUrl()}/certificates/${cert.publicId}` });
}

export async function markLessonViewed(userId: string, lessonId: string) {
  const lesson = await db.lesson.findFirst({ where: { id: lessonId, status: "PUBLISHED", deletedAt: null } });
  if (!lesson) throw new Error("Lesson not found");
  await requireActiveEnrollment(userId, lesson.courseId);
  await db.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    update: { lastViewedAt: new Date() },
    create: { userId, lessonId, courseId: lesson.courseId },
  });
  await db.enrollment.update({ where: { userId_courseId: { userId, courseId: lesson.courseId } }, data: { lastLessonId: lessonId } });
}

async function checkpointPool(lessonId: string): Promise<PoolQuestion[]> {
  const qs = await db.quizQuestion.findMany({
    where: { quiz: { lessonId } }, orderBy: { position: "asc" },
    select: { id: true, promptEn: true, options: { orderBy: { position: "asc" }, select: { id: true, textEn: true, isCorrect: true } } },
  });
  return buildCheckpointPool(qs);
}

export interface CheckpointState {
  required: boolean;
  passed: boolean;
  attempts: number;
  /** Questions without the isCorrect flag (never sent to the browser). */
  questions: { id: string; prompt: string; multi: boolean; options: { id: string; text: string }[] }[];
}

/** Returns (drawing if needed) the learner's current checkpoint for a lesson. */
export async function getCheckpoint(userId: string, lessonId: string): Promise<CheckpointState> {
  const lesson = await db.lesson.findUniqueOrThrow({ where: { id: lessonId }, select: { requireCheckpoint: true } });
  const none: CheckpointState = { required: false, passed: false, attempts: 0, questions: [] };
  if (!lesson.requireCheckpoint) return none;
  const pool = await checkpointPool(lessonId);
  if (!pool.length) return none;
  let row = await db.lessonCheckpoint.findUnique({ where: { userId_lessonId: { userId, lessonId } } });
  if (row?.passedAt) return { required: true, passed: true, attempts: row.attempts, questions: [] };
  const valid = new Set(pool.map((q) => q.id));
  if (!row || !row.questionIds.length || !row.questionIds.every((id) => valid.has(id))) {
    const ids = drawCheckpoint(pool, 2);
    row = await db.lessonCheckpoint.upsert({ where: { userId_lessonId: { userId, lessonId } }, update: { questionIds: ids }, create: { userId, lessonId, questionIds: ids } });
  }
  const byId = new Map(pool.map((q) => [q.id, q]));
  return {
    required: true, passed: false, attempts: row.attempts,
    questions: row.questionIds.map((id) => byId.get(id)!).map((q) => ({ id: q.id, prompt: q.prompt, multi: q.options.filter((o) => o.isCorrect).length > 1, options: q.options.map((o) => ({ id: o.id, text: o.text })) })),
  };
}

/** Grades the drawn checkpoint. Every question must be right; on success the lesson is completed. On failure a fresh draw is made. */
export async function submitCheckpoint(userId: string, lessonId: string, answers: Record<string, string[]>) {
  const lesson = await db.lesson.findFirst({ where: { id: lessonId, status: "PUBLISHED", deletedAt: null } });
  if (!lesson) throw new Error("Lesson not found");
  await requireActiveEnrollment(userId, lesson.courseId);
  const row = await db.lessonCheckpoint.findUnique({ where: { userId_lessonId: { userId, lessonId } } });
  if (!row || !row.questionIds.length) throw new Error("No checkpoint in progress");
  const pool = (await checkpointPool(lessonId)).filter((q) => row.questionIds.includes(q.id));
  const graded = gradeQuiz(pool.map((q) => ({ id: q.id, points: 1, options: q.options })), answers, 100);
  if (!graded.passed) {
    await db.lessonCheckpoint.update({ where: { id: row.id }, data: { attempts: { increment: 1 }, questionIds: [] } });
    return { passed: false };
  }
  await db.lessonCheckpoint.update({ where: { id: row.id }, data: { passedAt: new Date(), attempts: { increment: 1 } } });
  await markLessonComplete(userId, lesson.id, lesson.courseId);
  return { passed: true };
}

async function markLessonComplete(userId: string, lessonId: string, courseId: string) {
  await db.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    update: { completedAt: new Date() },
    create: { userId, lessonId, courseId, completedAt: new Date() },
  });
  return recomputeCourse(userId, courseId);
}

/** Manual completion is only allowed for lessons without a required checkpoint. */
export async function completeLesson(userId: string, lessonId: string) {
  const lesson = await db.lesson.findFirst({ where: { id: lessonId, status: "PUBLISHED", deletedAt: null } });
  if (!lesson) throw new Error("Lesson not found");
  await requireActiveEnrollment(userId, lesson.courseId);
  const cp = await getCheckpoint(userId, lessonId);
  if (cp.required && !cp.passed) throw new Error("Checkpoint required");
  return markLessonComplete(userId, lessonId, lesson.courseId);
}

export async function submitQuiz(userId: string, quizId: string, submitted: Record<string, string[]>) {
  const quiz = await db.quiz.findFirst({
    where: { id: quizId, status: "PUBLISHED", course: { status: "PUBLISHED", deletedAt: null }, OR: [{ lessonId: null }, { lesson: { status: "PUBLISHED", deletedAt: null } }] },
    include: { questions: { orderBy: { position: "asc" }, include: { options: true } } },
  });
  if (!quiz) throw new Error("Quiz not available");
  await requireActiveEnrollment(userId, quiz.courseId);
  const graded = gradeQuiz(quiz.questions, submitted, quiz.passMark);
  // Serialize per user+quiz so concurrent submissions cannot exceed maxAttempts.
  const attempt = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId + ":" + quizId}))`;
    const used = await tx.quizAttempt.count({ where: { userId, quizId, submittedAt: { not: null } } });
    if (attemptsRemaining(quiz.maxAttempts, used) === 0) throw new Error("No attempts remaining");
    return tx.quizAttempt.create({
    data: {
      userId, quizId, scorePct: graded.scorePct, passed: graded.passed, submittedAt: new Date(),
      answers: { create: graded.results.map((r) => ({ questionId: r.questionId, optionIds: r.optionIds, isCorrect: r.isCorrect })) },
    },
    });
  });
  const course = await recomputeCourse(userId, quiz.courseId);
  return { attemptId: attempt.id, scorePct: graded.scorePct, passed: graded.passed, courseComplete: course.complete };
}

export async function toggleBookmark(userId: string, lessonId: string) {
  const lesson = await db.lesson.findFirst({ where: { id: lessonId, deletedAt: null } });
  if (!lesson) throw new Error("Lesson not found");
  await requireActiveEnrollment(userId, lesson.courseId);
  const ex = await db.bookmark.findUnique({ where: { userId_lessonId: { userId, lessonId } } });
  if (ex) await db.bookmark.delete({ where: { id: ex.id } });
  else await db.bookmark.create({ data: { userId, lessonId } });
}
