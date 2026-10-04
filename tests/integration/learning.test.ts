import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { completeLesson, enroll, getCheckpoint, submitCheckpoint, submitQuiz, toggleBookmark, markLessonViewed } from "@/lib/learning";
import { buildCheckpointPool } from "@/lib/domain";
import { hashPassword } from "@/lib/auth-core";

let userId: string, otherId: string, courseId: string;

/** Completes a lesson the way a learner must: by answering its checkpoint correctly (or directly if none). */
async function finishLesson(uid: string, lessonId: string) {
  const cp = await getCheckpoint(uid, lessonId);
  if (!cp.required || cp.passed) return completeLesson(uid, lessonId);
  const qs = await db.quizQuestion.findMany({ where: { quiz: { lessonId } }, select: { id: true, promptEn: true, options: { select: { id: true, textEn: true, isCorrect: true } } } });
  const pool = buildCheckpointPool(qs);
  const answers = Object.fromEntries(cp.questions.map((q) => [q.id, pool.find((p) => p.id === q.id)!.options.filter((o) => o.isCorrect).map((o) => o.id)]));
  const r = await submitCheckpoint(uid, lessonId, answers);
  if (!r.passed) throw new Error("checkpoint unexpectedly failed");
  return completeLesson(uid, lessonId);
}

beforeAll(async () => {
  const mk = async (email: string) => (await db.user.upsert({ where: { email }, update: {}, create: { email, firstName: "Test", lastName: "Learner", passwordHash: await hashPassword("Passw0rd!!x"), status: "ACTIVE" } })).id;
  userId = await mk("int-learner@test.local");
  otherId = await mk("int-other@test.local");
  await db.certificate.deleteMany({ where: { userId } });
  await db.enrollment.deleteMany({ where: { userId } });
  await db.quizAttempt.deleteMany({ where: { userId } });
  await db.lessonProgress.deleteMany({ where: { userId } });
  courseId = (await db.course.findUniqueOrThrow({ where: { code: "EG-MED-03" } })).id; // diabetes: 6 lessons, quizzes are DRAFT
});

describe("enrollment", () => {
  it("rejects unpublished courses and is idempotent", async () => {
    const draft = await db.course.create({ data: { slug: `draft-${Date.now()}`, titleEn: "Draft", status: "DRAFT" } });
    await expect(enroll(userId, draft.id)).rejects.toThrow(/not available/);
    const a = await enroll(userId, courseId);
    const b = await enroll(userId, courseId);
    expect(b.id).toBe(a.id);
    expect(await db.enrollment.count({ where: { userId, courseId } })).toBe(1);
  });
});

describe("progress and authorization of learning actions", () => {
  it("refuses progress for a user who is not enrolled", async () => {
    const l = await db.lesson.findFirstOrThrow({ where: { courseId } });
    await expect(completeLesson(otherId, l.id)).rejects.toThrow(/Not enrolled/);
    await expect(markLessonViewed(otherId, l.id)).rejects.toThrow(/Not enrolled/);
    await expect(toggleBookmark(otherId, l.id)).rejects.toThrow(/Not enrolled/);
  });
  it("blocks manual completion while a checkpoint is required, and fails wrong answers with a fresh draw", async () => {
    const l = (await db.lesson.findMany({ where: { courseId }, orderBy: { position: "asc" } }))[1];
    await expect(completeLesson(userId, l.id)).rejects.toThrow(/Checkpoint required/);
    const cp = await getCheckpoint(userId, l.id);
    expect(cp.required).toBe(true);
    expect(cp.questions.length).toBe(2);
    expect(JSON.stringify(cp)).not.toContain("isCorrect"); // answers never leave the server
    const wrong = Object.fromEntries(cp.questions.map((q) => [q.id, []]));
    expect(await submitCheckpoint(userId, l.id, wrong)).toEqual({ passed: false });
    await expect(completeLesson(userId, l.id)).rejects.toThrow(/Checkpoint required/);
    const after = await getCheckpoint(userId, l.id);
    expect(after.attempts).toBe(1);
  });
  it("tracks progress server-side and resumes position", async () => {
    const lessons = await db.lesson.findMany({ where: { courseId }, orderBy: { position: "asc" } });
    await markLessonViewed(userId, lessons[2].id);
    expect((await db.enrollment.findFirstOrThrow({ where: { userId, courseId } })).lastLessonId).toBe(lessons[2].id);
    const r = await finishLesson(userId, lessons[0].id);
    expect(r).toMatchObject({ done: 1, total: 6, percent: 17, complete: false });
    expect(await finishLesson(userId, lessons[0].id)).toMatchObject({ done: 1 }); // idempotent
  });
  it("completes the course and issues exactly one certificate with a non-guessable ID", async () => {
    const lessons = await db.lesson.findMany({ where: { courseId }, orderBy: { position: "asc" } });
    let last;
    for (const l of lessons) last = await finishLesson(userId, l.id);
    expect(last!.complete).toBe(true);
    const e = await db.enrollment.findFirstOrThrow({ where: { userId, courseId } });
    expect(e.status).toBe("COMPLETED");
    const certs = await db.certificate.findMany({ where: { userId, courseId } });
    expect(certs).toHaveLength(1);
    expect(certs[0].publicId).toMatch(/^LA-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    await finishLesson(userId, lessons[0].id);
    expect(await db.certificate.count({ where: { userId, courseId } })).toBe(1);
  });
});

describe("quizzes", () => {
  it("grades on the server, enforces attempts, and gates completion on required quizzes", async () => {
    const cv = (await db.course.findUniqueOrThrow({ where: { code: "EG-MED-01" } })).id;
    await enroll(userId, cv);
    const lessons = await db.lesson.findMany({ where: { courseId: cv }, orderBy: { position: "asc" } });
    for (const l of lessons) await finishLesson(userId, l.id);
    expect((await db.enrollment.findFirstOrThrow({ where: { userId, courseId: cv } })).status).toBe("ACTIVE"); // quizzes outstanding
    const quizzes = await db.quiz.findMany({ where: { courseId: cv, status: "PUBLISHED" }, include: { questions: { include: { options: true } } } });
    expect(quizzes.length).toBe(8);
    // Failing attempt first (all-wrong answers) on quiz 0
    const wrong = Object.fromEntries(quizzes[0].questions.map((q) => [q.id, [q.options.find((o) => !o.isCorrect)!.id]]));
    const f = await submitQuiz(userId, quizzes[0].id, wrong);
    expect(f.passed).toBe(false);
    let final;
    for (const q of quizzes) {
      const right = Object.fromEntries(q.questions.map((x) => [x.id, x.options.filter((o) => o.isCorrect).map((o) => o.id)]));
      final = await submitQuiz(userId, q.id, right);
      expect(final).toMatchObject({ scorePct: 100, passed: true });
    }
    expect(final!.courseComplete).toBe(true);
    expect(await db.certificate.count({ where: { userId, courseId: cv } })).toBe(1);
  });
  it("rejects quiz submission without enrollment and limits attempts", async () => {
    const q = await db.quiz.findFirstOrThrow({ where: { status: "PUBLISHED", course: { code: "EG-MED-02" } }, orderBy: { createdAt: "desc" } });
    await expect(submitQuiz(otherId, q.id, {})).rejects.toThrow(/Not enrolled/);
    await db.quiz.update({ where: { id: q.id }, data: { maxAttempts: 1 } });
    await enroll(otherId, q.courseId);
    await submitQuiz(otherId, q.id, {});
    await expect(submitQuiz(otherId, q.id, {})).rejects.toThrow(/No attempts remaining/);
    await db.quiz.update({ where: { id: q.id }, data: { maxAttempts: 0 } });
  });
  it("cannot exceed maxAttempts with concurrent submissions", async () => {
    const q = await db.quiz.findFirstOrThrow({ where: { status: "PUBLISHED", course: { code: "EG-MED-02" } }, orderBy: { createdAt: "desc" } });
    await db.quizAttempt.deleteMany({ where: { userId: otherId, quizId: q.id } });
    await db.quiz.update({ where: { id: q.id }, data: { maxAttempts: 2 } });
    const res = await Promise.allSettled(Array.from({ length: 6 }, () => submitQuiz(otherId, q.id, {})));
    expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    await db.quiz.update({ where: { id: q.id }, data: { maxAttempts: 0 } });
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
