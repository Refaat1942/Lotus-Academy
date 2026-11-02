import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { completeLesson, enroll, startAttempt, submitAttempt, toggleBookmark, markLessonViewed } from "@/lib/learning";
import { hashPassword } from "@/lib/auth-core";

let userId: string, otherId: string;

/** Answers the served attempt (all correct unless `wrong`). */
async function takeQuiz(uid: string, quizId: string, wrong = false) {
  const view = await startAttempt(uid, quizId);
  if (!view) throw new Error("no attempts left");
  const qs = await db.quizQuestion.findMany({ where: { id: { in: view.questions.map((q) => q.id) } }, include: { options: true } });
  const answers = Object.fromEntries(qs.map((q) => [q.id, q.options.filter((o) => (wrong ? !o.isCorrect : o.isCorrect)).slice(0, 1).map((o) => o.id)]));
  return { view, result: await submitAttempt(uid, view.attemptId, answers) };
}

/** Completes a lesson the way a learner must: pass its quiz if it has one, otherwise mark it complete. */
async function finishLesson(uid: string, lessonId: string) {
  const quiz = await db.quiz.findFirst({ where: { lessonId, status: "PUBLISHED" } });
  if (quiz) return (await takeQuiz(uid, quiz.id)).result;
  return completeLesson(uid, lessonId);
}

beforeAll(async () => {
  const mk = async (email: string) => (await db.user.upsert({ where: { email }, update: {}, create: { email, firstName: "Test", lastName: "Learner", passwordHash: await hashPassword("Passw0rd!!x"), status: "ACTIVE" } })).id;
  userId = await mk("int-learner@test.local");
  otherId = await mk("int-other@test.local");
  for (const uid of [userId, otherId]) {
    await db.certificate.deleteMany({ where: { userId: uid } });
    await db.enrollment.deleteMany({ where: { userId: uid } });
    await db.quizAttempt.deleteMany({ where: { userId: uid } });
    await db.lessonProgress.deleteMany({ where: { userId: uid } });
  }
});

describe("enrollment", () => {
  it("rejects unpublished courses and is idempotent", async () => {
    const draft = await db.course.create({ data: { slug: `draft-${Date.now()}`, titleEn: "Draft", status: "DRAFT" } });
    await expect(enroll(userId, draft.id)).rejects.toThrow(/not available/);
    const c = await db.course.findUniqueOrThrow({ where: { code: "EG-RET-01" } });
    const a = await enroll(userId, c.id);
    const b = await enroll(userId, c.id);
    expect(b.id).toBe(a.id);
  });
});

describe("lesson quizzes gate progress", () => {
  it("refuses everything to a learner who is not enrolled", async () => {
    const l = await db.lesson.findFirstOrThrow({ where: { course: { code: "EG-RET-01" } }, orderBy: { position: "asc" } });
    const q = await db.quiz.findFirstOrThrow({ where: { lessonId: l.id } });
    await expect(completeLesson(otherId, l.id)).rejects.toThrow(/Not enrolled/);
    await expect(markLessonViewed(otherId, l.id)).rejects.toThrow(/Not enrolled/);
    await expect(toggleBookmark(otherId, l.id)).rejects.toThrow(/Not enrolled/);
    await expect(startAttempt(otherId, q.id)).rejects.toThrow(/Not enrolled/);
  });

  it("serves 5 random questions with no answer keys, keeps the same draw on reload, and a fresh draw after submitting", async () => {
    const l = await db.lesson.findFirstOrThrow({ where: { course: { code: "EG-RET-01" } }, orderBy: { position: "asc" } });
    const q = await db.quiz.findFirstOrThrow({ where: { lessonId: l.id } });
    const v1 = await startAttempt(userId, q.id);
    expect(v1!.questions).toHaveLength(5);
    expect(JSON.stringify(v1)).not.toContain("isCorrect");
    const again = await startAttempt(userId, q.id);
    expect(again!.attemptId).toBe(v1!.attemptId);
    expect(again!.questions.map((x) => x.id)).toEqual(v1!.questions.map((x) => x.id));
    // failing does not complete the lesson; manual completion is refused
    const fail = await submitAttempt(userId, v1!.attemptId, {});
    expect(fail.passed).toBe(false);
    await expect(completeLesson(userId, l.id)).rejects.toThrow(/Pass the lesson quiz/);
    expect(await db.lessonProgress.count({ where: { userId, lessonId: l.id, completedAt: { not: null } } })).toBe(0);
    await expect(submitAttempt(userId, v1!.attemptId, {})).rejects.toThrow(/no longer open/); // no double submit
    // passing completes the lesson
    const { view, result } = await takeQuiz(userId, q.id);
    expect(view.attemptId).not.toBe(v1!.attemptId);
    expect(result.passed).toBe(true);
    expect(await db.lessonProgress.count({ where: { userId, lessonId: l.id, completedAt: { not: null } } })).toBe(1);
  });

  it("only grades the questions that were served (answers to other questions are ignored)", async () => {
    const l = (await db.lesson.findMany({ where: { course: { code: "EG-RET-01" } }, orderBy: { position: "asc" } }))[1];
    const q = await db.quiz.findFirstOrThrow({ where: { lessonId: l.id }, include: { questions: { include: { options: true } } } });
    const view = await startAttempt(userId, q.id);
    const served = new Set(view!.questions.map((x) => x.id));
    const unserved = q.questions.filter((x) => !served.has(x.id));
    const answers = Object.fromEntries(unserved.map((x) => [x.id, [x.options.find((o) => o.isCorrect)!.id]]));
    const r = await submitAttempt(userId, view!.attemptId, answers);
    expect(r.scorePct).toBe(0);
  });
});

describe("final exam and certificate", () => {
  it("locks the final exam until all lessons are done, limits attempts, then issues exactly one certificate", async () => {
    const c = await db.course.findUniqueOrThrow({ where: { code: "EG-RET-01" }, include: { lessons: { where: { status: "PUBLISHED" }, orderBy: { position: "asc" } } } });
    const exam = await db.quiz.findFirstOrThrow({ where: { courseId: c.id, lessonId: null } });
    expect(exam).toMatchObject({ drawCount: 20, maxAttempts: 3 });
    await expect(startAttempt(userId, exam.id)).rejects.toThrow(/Complete all lessons/);
    for (const l of c.lessons) await finishLesson(userId, l.id);
    expect((await db.enrollment.findFirstOrThrow({ where: { userId, courseId: c.id } })).status).toBe("ACTIVE"); // exam outstanding
    await takeQuiz(userId, exam.id, true);
    await takeQuiz(userId, exam.id, true);
    const last = await takeQuiz(userId, exam.id);
    expect(last.result).toMatchObject({ passed: true, courseComplete: true });
    expect(await startAttempt(userId, exam.id)).toBeNull(); // 3 attempts used
    expect(await db.certificate.count({ where: { userId, courseId: c.id } })).toBe(1);
  });

  it("cannot exceed maxAttempts with parallel starts/submits", async () => {
    const c = await db.course.findUniqueOrThrow({ where: { code: "EG-COM-01" }, include: { lessons: { where: { status: "PUBLISHED" } } } });
    await enroll(otherId, c.id);
    for (const l of c.lessons) await finishLesson(otherId, l.id);
    const exam = await db.quiz.findFirstOrThrow({ where: { courseId: c.id, lessonId: null } });
    const results = await Promise.allSettled(Array.from({ length: 6 }, async () => { const v = await startAttempt(otherId, exam.id); if (!v) throw new Error("none"); return submitAttempt(otherId, v.attemptId, {}); }));
    expect(results.filter((r) => r.status === "fulfilled").length).toBeLessThanOrEqual(3);
    expect(await db.quizAttempt.count({ where: { userId: otherId, quizId: exam.id, submittedAt: { not: null } } })).toBeLessThanOrEqual(3);
  });
});

describe("RBAC data model", () => {
  it("seeds roles with least-privilege permissions", async () => {
    const perms = async (key: string) => (await db.rolePermission.findMany({ where: { role: { key } }, include: { permission: true } })).map((p) => p.permission.key);
    expect(await perms("STUDENT")).toEqual([]);
    expect(await perms("ADMIN")).not.toContain("roles.write");
    expect(await perms("SUPER_ADMIN")).toContain("roles.write");
    expect(await perms("INSTRUCTOR")).not.toContain("users.write");
    expect(await perms("SUPPORT")).not.toContain("courses.write");
  });
});
