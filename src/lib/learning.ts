import { db } from "./db";
import { audit } from "./audit";
import { computeCompletion, gradeQuiz, attemptsRemaining, drawQuestions, shuffle } from "./domain";
import type { Prisma } from "@prisma/client";
import { newCertificateId } from "./tokens";
import { sendMail } from "./mail";
import { env } from "./env";
import { refreshPathCompletion } from "./paths";

export const publishedLessonsWhere = (courseId: string) => ({ courseId, status: "PUBLISHED" as const, deletedAt: null });

export async function enroll(userId: string, courseId: string) {
  const course = await db.course.findFirst({ where: { id: courseId, status: "PUBLISHED", deletedAt: null } });
  if (!course) throw new Error("Course not available");
  if (course.visibility === "AUDIENCE") {
    const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { audienceId: true, roles: { select: { role: { select: { key: true } } } } } });
    const staff = u.roles.some((r) => r.role.key !== "STUDENT");
    const targeted = u.audienceId ? await db.courseAudience.count({ where: { courseId, audienceId: u.audienceId } }) : 0;
    if (!staff && !targeted) throw new Error("Course not available");
  }
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
  // Lesson quizzes gate lesson completion; only course-level exams (lessonId = null) are separately required.
  // During a certificate renewal only final-exam passes since the renewal opened count.
  const since = await renewalSince(userId, courseId);
  const quizzes = await db.quiz.findMany({
    where: { courseId, status: "PUBLISHED", required: true, lessonId: null },
    select: { id: true, attempts: { where: { userId, passed: true, ...(since ? { startedAt: { gte: since } } : {}) }, select: { id: true }, take: 1 } },
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

export async function renewalSince(userId: string, courseId: string) {
  return (await db.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } }, select: { renewalSince: true } }))?.renewalSince ?? null;
}

/** Certificate expiry for a course with a validity period (null = does not expire). */
export function expiryFrom(validityMonths: number | null | undefined, from = new Date()) {
  if (!validityMonths) return null;
  const d = new Date(from);
  d.setMonth(d.getMonth() + validityMonths);
  return d;
}

export type CertState = "valid" | "expiring" | "expired" | "revoked";
export function certState(c: { revokedAt: Date | null; expiresAt: Date | null }, now = new Date()): CertState {
  if (c.revokedAt) return "revoked";
  if (!c.expiresAt) return "valid";
  if (c.expiresAt < now) return "expired";
  return c.expiresAt.getTime() - now.getTime() < 30 * 86400_000 ? "expiring" : "valid";
}

/**
 * Opens a certificate renewal: the learner keeps lesson progress but must pass the final exam again
 * (with a fresh set of attempts) before the due date. Idempotent.
 */
export async function openRenewal(userId: string, courseId: string, now = new Date()) {
  const [e, cert] = await Promise.all([
    db.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } }),
    db.certificate.findUnique({ where: { userId_courseId: { userId, courseId } } }),
  ]);
  if (!e || !cert || e.renewalSince || e.status === "CANCELLED") return false;
  const minDue = new Date(now.getTime() + 14 * 86400_000);
  const dueAt = cert.expiresAt && cert.expiresAt > minDue ? cert.expiresAt : minDue;
  await db.enrollment.update({ where: { id: e.id }, data: { renewalSince: now, status: "ACTIVE", dueAt } });
  await recomputeCourse(userId, courseId);
  return true;
}

async function completeCourse(userId: string, courseId: string) {
  const enrollment = await db.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
  if (!enrollment || enrollment.status === "COMPLETED") return;
  const [user, course] = await Promise.all([db.user.findUniqueOrThrow({ where: { id: userId } }), db.course.findUniqueOrThrow({ where: { id: courseId } })]);
  const now = new Date();
  const renewing = !!enrollment.renewalSince;
  const cert = await db.$transaction(async (tx) => {
    await tx.enrollment.update({ where: { id: enrollment.id }, data: { status: "COMPLETED", completedAt: now, renewalSince: null } });
    const existing = await tx.certificate.findUnique({ where: { userId_courseId: { userId, courseId } } });
    if (existing) {
      if (!renewing) return existing;
      const r = await tx.certificate.update({ where: { id: existing.id }, data: { renewedAt: now, expiresAt: expiryFrom(course.validityMonths, now), revokedAt: null } });
      await tx.notification.create({ data: { userId, type: "certificate", title: `Certificate renewed: ${course.titleEn}`, href: `/certificates/${r.publicId}` } });
      return r;
    }
    const c = await tx.certificate.create({
      data: { publicId: newCertificateId(), userId, courseId, recipientName: `${user.firstName} ${user.lastName}`.trim(), courseTitle: course.titleEn, expiresAt: expiryFrom(course.validityMonths, now) },
    });
    await tx.notification.create({ data: { userId, type: "certificate", title: `Certificate ready: ${course.titleEn}`, href: `/certificates/${c.publicId}` } });
    return c;
  });
  await audit(userId, renewing ? "certificate.renewed" : "course.completed", "Course", courseId);
  await refreshPathCompletion(userId);
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

/** The published quiz of a lesson, if it has at least one usable question. */
export async function lessonQuiz(lessonId: string) {
  const q = await db.quiz.findFirst({ where: { lessonId, status: "PUBLISHED" }, include: { _count: { select: { questions: true } } } });
  return q && q._count.questions > 0 ? q : null;
}

/** A lesson with a published quiz (and the "require quiz" switch on) is completed only by passing that quiz. */
export async function lessonNeedsQuiz(lessonId: string) {
  const lesson = await db.lesson.findUniqueOrThrow({ where: { id: lessonId }, select: { requireCheckpoint: true } });
  return lesson.requireCheckpoint && !!(await lessonQuiz(lessonId));
}

async function markLessonComplete(userId: string, lessonId: string, courseId: string) {
  await db.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    update: { completedAt: new Date() },
    create: { userId, lessonId, courseId, completedAt: new Date() },
  });
  return recomputeCourse(userId, courseId);
}

/** Manual completion is only allowed for reading lessons (no required quiz). */
export async function completeLesson(userId: string, lessonId: string) {
  const lesson = await db.lesson.findFirst({ where: { id: lessonId, status: "PUBLISHED", deletedAt: null } });
  if (!lesson) throw new Error("Lesson not found");
  await requireActiveEnrollment(userId, lesson.courseId);
  if (await lessonNeedsQuiz(lessonId)) throw new Error("Pass the lesson quiz to complete this lesson");
  return markLessonComplete(userId, lessonId, lesson.courseId);
}

async function loadQuiz(quizId: string) {
  return db.quiz.findFirst({
    where: { id: quizId, status: "PUBLISHED", course: { status: "PUBLISHED", deletedAt: null }, OR: [{ lessonId: null }, { lesson: { status: "PUBLISHED", deletedAt: null } }] },
    include: { questions: { orderBy: { position: "asc" }, include: { options: { orderBy: { position: "asc" } } } } },
  });
}

async function assertFinalExamOpen(userId: string, courseId: string) {
  const [total, done] = await Promise.all([
    db.lesson.count({ where: publishedLessonsWhere(courseId) }),
    db.lessonProgress.count({ where: { userId, courseId, completedAt: { not: null }, lesson: { status: "PUBLISHED", deletedAt: null } } }),
  ]);
  if (done < total) throw new Error("Complete all lessons before the final exam");
}

export interface AttemptView {
  attemptId: string;
  quizId: string;
  remaining: number | null;
  /** Questions in the served order, options in the served order — never includes which option is correct. */
  questions: { id: string; type: string; promptEn: string; promptAr: string | null; options: { id: string; textEn: string; textAr: string | null }[] }[];
}

/**
 * Returns the learner's open attempt or starts a new one with a fresh random draw.
 * Returns null when no attempts remain.
 */
export async function startAttempt(userId: string, quizId: string): Promise<AttemptView | null> {
  const quiz = await loadQuiz(quizId);
  if (!quiz) throw new Error("Quiz not available");
  await requireActiveEnrollment(userId, quiz.courseId);
  if (!quiz.lessonId) await assertFinalExamOpen(userId, quiz.courseId);
  const since = quiz.lessonId ? null : await renewalSince(userId, quiz.courseId);
  const window = since ? { startedAt: { gte: since } } : {};
  const used = await db.quizAttempt.count({ where: { userId, quizId, submittedAt: { not: null }, ...window } });
  const remaining = attemptsRemaining(quiz.maxAttempts, used);
  const valid = new Set(quiz.questions.map((q) => q.id));
  // One open attempt per learner and quiz: serialise concurrent starts with a transaction-scoped advisory lock.
  const attempt = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId + ":" + quizId}))`;
    let open = await tx.quizAttempt.findFirst({ where: { userId, quizId, submittedAt: null }, orderBy: { startedAt: "desc" } });
    if (open && (!open.questionIds.length || !open.questionIds.every((id) => valid.has(id)) || (since && open.startedAt < since))) {
      await tx.quizAttempt.delete({ where: { id: open.id } }); // bank changed since it was drawn, or drawn before a renewal
      open = null;
    }
    if (open) return open;
    if (remaining === 0) return null;
    const ids = drawQuestions(quiz.questions.map((q) => q.id), quiz.drawCount);
    const order = Object.fromEntries(quiz.questions.filter((q) => ids.includes(q.id)).map((q) => [q.id, shuffle(q.options.map((o) => o.id))]));
    return tx.quizAttempt.create({ data: { userId, quizId, questionIds: ids, optionOrder: order as Prisma.InputJsonValue } });
  });
  if (!attempt) return null;
  const byId = new Map(quiz.questions.map((q) => [q.id, q]));
  const order = (attempt.optionOrder ?? {}) as Record<string, string[]>;
  return {
    attemptId: attempt.id, quizId, remaining,
    questions: attempt.questionIds.map((id) => byId.get(id)!).map((q) => {
      const opts = new Map(q.options.map((o) => [o.id, o]));
      const ids = (order[q.id] ?? q.options.map((o) => o.id)).filter((x) => opts.has(x));
      return { id: q.id, type: q.type, promptEn: q.promptEn, promptAr: q.promptAr, options: ids.map((x) => { const o = opts.get(x)!; return { id: o.id, textEn: o.textEn, textAr: o.textAr }; }) };
    }),
  };
}

/** Grades an open attempt (only the questions that were served). Passing a lesson quiz completes the lesson. */
export async function submitAttempt(userId: string, attemptId: string, submitted: Record<string, string[]>) {
  const attempt = await db.quizAttempt.findFirst({ where: { id: attemptId, userId, submittedAt: null } });
  if (!attempt) throw new Error("This attempt is no longer open");
  const quiz = await loadQuiz(attempt.quizId);
  if (!quiz) throw new Error("Quiz not available");
  await requireActiveEnrollment(userId, quiz.courseId);
  if (!quiz.lessonId) await assertFinalExamOpen(userId, quiz.courseId);
  const served = new Set(attempt.questionIds);
  const graded = gradeQuiz(quiz.questions.filter((q) => served.has(q.id)), submitted, quiz.passMark);
  // Close the attempt exactly once and never beyond maxAttempts (serialised per learner + quiz).
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId + ":" + quiz.id}))`;
    const since = quiz.lessonId ? null : await renewalSince(userId, quiz.courseId);
    const used = await tx.quizAttempt.count({ where: { userId, quizId: quiz.id, submittedAt: { not: null }, ...(since ? { startedAt: { gte: since } } : {}) } });
    if (attemptsRemaining(quiz.maxAttempts, used) === 0) throw new Error("No attempts remaining");
    const closed = await tx.quizAttempt.updateMany({ where: { id: attempt.id, submittedAt: null }, data: { submittedAt: new Date(), scorePct: graded.scorePct, passed: graded.passed } });
    if (closed.count !== 1) throw new Error("This attempt is no longer open");
  });
  await db.quizAnswer.createMany({ data: graded.results.map((r) => ({ attemptId: attempt.id, questionId: r.questionId, optionIds: r.optionIds, isCorrect: r.isCorrect })) });
  if (graded.passed && quiz.lessonId) await markLessonComplete(userId, quiz.lessonId, quiz.courseId);
  const course = await recomputeCourse(userId, quiz.courseId);
  return { attemptId: attempt.id, scorePct: graded.scorePct, passed: graded.passed, courseComplete: course.complete };
}

/** Convenience used by tests/scripts: start (or resume) an attempt and submit it in one call. */
export async function submitQuiz(userId: string, quizId: string, submitted: Record<string, string[]>) {
  const view = await startAttempt(userId, quizId);
  if (!view) throw new Error("No attempts remaining");
  return submitAttempt(userId, view.attemptId, submitted);
}

export async function toggleBookmark(userId: string, lessonId: string) {
  const lesson = await db.lesson.findFirst({ where: { id: lessonId, deletedAt: null } });
  if (!lesson) throw new Error("Lesson not found");
  await requireActiveEnrollment(userId, lesson.courseId);
  const ex = await db.bookmark.findUnique({ where: { userId_lessonId: { userId, lessonId } } });
  if (ex) await db.bookmark.delete({ where: { id: ex.id } });
  else await db.bookmark.create({ data: { userId, lessonId } });
}
