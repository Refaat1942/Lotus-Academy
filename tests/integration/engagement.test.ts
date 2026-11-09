import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { enroll, startAttempt, submitAttempt, completeLesson } from "@/lib/learning";
import { hashPassword } from "@/lib/auth-core";
import { runReminders, nudge } from "@/lib/reminders";
import { syncAssignments } from "@/lib/audience";
import { myPaths, pathBlocker, refreshPathCompletion } from "@/lib/paths";
import { managerScope, teamMembers, inScope } from "@/lib/team";
import { answerDaily, getDaily, leaderboard, POINTS } from "@/lib/engagement";

const P = "eng-";
const mk = async (email: string, data: Record<string, unknown> = {}) =>
  db.user.create({ data: { email, firstName: "Eng", lastName: email.split("@")[0], passwordHash: await hashPassword("Passw0rd!!x"), status: "ACTIVE", ...data } });

async function takeQuiz(uid: string, quizId: string) {
  const view = await startAttempt(uid, quizId);
  if (!view) throw new Error("no attempts left");
  const qs = await db.quizQuestion.findMany({ where: { id: { in: view.questions.map((q) => q.id) } }, include: { options: true } });
  return submitAttempt(uid, view.attemptId, Object.fromEntries(qs.map((q) => [q.id, q.options.filter((o) => o.isCorrect).slice(0, 1).map((o) => o.id)])));
}
async function finishCourse(uid: string, code: string) {
  const c = await db.course.findUniqueOrThrow({ where: { code }, include: { lessons: { where: { status: "PUBLISHED", deletedAt: null }, orderBy: { position: "asc" } } } });
  await enroll(uid, c.id);
  for (const l of c.lessons) {
    const q = await db.quiz.findFirst({ where: { lessonId: l.id, status: "PUBLISHED" } });
    if (q) await takeQuiz(uid, q.id); else await completeLesson(uid, l.id);
  }
  const final = await db.quiz.findFirstOrThrow({ where: { courseId: c.id, lessonId: null, status: "PUBLISHED" } });
  await takeQuiz(uid, final.id);
  return { course: c, final };
}

async function cleanup() {
  const users = await db.user.findMany({ where: { email: { startsWith: P } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await db.certificate.deleteMany({ where: { userId: { in: ids } } });
  await db.reminderLog.deleteMany({ where: { userId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.learningPath.deleteMany({ where: { slug: { startsWith: P } } });
  await db.course.updateMany({ where: { code: "EG-DRM-03" }, data: { validityMonths: null } });
}
beforeAll(cleanup);
afterAll(cleanup);

describe("certificate validity and renewal", () => {
  it("opens a renewal before expiry, gives fresh final-exam attempts, and renews the same certificate", async () => {
    const u = await mk(`${P}renew@test.local`);
    const { course, final } = await finishCourse(u.id, "EG-DRM-03");
    await db.course.update({ where: { id: course.id }, data: { validityMonths: 12 } });
    const cert = await db.certificate.findUniqueOrThrow({ where: { userId_courseId: { userId: u.id, courseId: course.id } } });
    await db.certificate.update({ where: { id: cert.id }, data: { expiresAt: new Date(Date.now() + 10 * 86400_000) } });

    const r = await runReminders();
    expect(r.renewals).toBeGreaterThanOrEqual(1);
    const e = await db.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: u.id, courseId: course.id } } });
    expect(e.status).toBe("ACTIVE");
    expect(e.renewalSince).not.toBeNull();
    expect(e.dueAt!.getTime()).toBeGreaterThan(Date.now() + 9 * 86400_000);
    expect((await runReminders()).renewals).toBe(0); // idempotent

    const view = await startAttempt(u.id, final.id);
    expect(view!.remaining).toBe(final.maxAttempts); // earlier attempts don't count during renewal
    await takeQuiz(u.id, final.id);
    const renewed = await db.certificate.findUniqueOrThrow({ where: { id: cert.id } });
    expect(renewed.publicId).toBe(cert.publicId);
    expect(renewed.renewedAt).not.toBeNull();
    expect(renewed.expiresAt!.getTime()).toBeGreaterThan(Date.now() + 360 * 86400_000);
    const after = await db.enrollment.findUniqueOrThrow({ where: { id: e.id } });
    expect(after).toMatchObject({ status: "COMPLETED", renewalSince: null });
  });
});

describe("learning paths", () => {
  it("auto-assigns new hires, locks later courses until earlier ones are complete, and records completion", async () => {
    const ph = await db.audience.findUniqueOrThrow({ where: { key: "PHARMACIST" } });
    const [a, b] = await Promise.all(["EG-COM-01", "EG-DRM-01"].map((code) => db.course.findUniqueOrThrow({ where: { code } })));
    const path = await db.learningPath.create({ data: { slug: `${P}onboarding`, titleEn: "Onboarding", audienceId: ph.id, autoAssignNewHires: true, dueDays: 30, published: true, createdAt: new Date(Date.now() - 60_000), courses: { create: [{ courseId: a.id, position: 0 }, { courseId: b.id, position: 1 }] } } });
    const old = await mk(`${P}old@test.local`, { audienceId: ph.id, createdAt: new Date(Date.now() - 86400_000) });
    const hire = await mk(`${P}hire@test.local`, { audienceId: ph.id });
    await syncAssignments({ userId: old.id });
    await syncAssignments({ userId: hire.id });
    expect(await db.pathEnrollment.count({ where: { pathId: path.id, userId: old.id } })).toBe(0); // existing staff are not auto-assigned
    const pe = await db.pathEnrollment.findUniqueOrThrow({ where: { userId_pathId: { userId: hire.id, pathId: path.id } } });
    expect(Math.round((pe.dueAt!.getTime() - Date.now()) / 86400_000)).toBe(30);
    const es = await db.enrollment.findMany({ where: { userId: hire.id } });
    expect(es.map((e) => e.courseId).sort()).toEqual([a.id, b.id].sort());
    expect(es.every((e) => e.source === "assigned" && e.dueAt)).toBe(true);

    expect(await pathBlocker(hire.id, a.id)).toBeNull();
    expect((await pathBlocker(hire.id, b.id))?.blocker.courseId).toBe(a.id);
    const steps = (await myPaths(hire.id))[0].steps;
    expect(steps.map((s) => [s.done, s.locked, s.current])).toEqual([[false, false, true], [false, true, false]]);

    await db.enrollment.updateMany({ where: { userId: hire.id }, data: { status: "COMPLETED", completedAt: new Date() } });
    expect(await pathBlocker(hire.id, b.id)).toBeNull();
    await refreshPathCompletion(hire.id);
    expect((await db.pathEnrollment.findUniqueOrThrow({ where: { id: pe.id } })).completedAt).not.toBeNull();
  });
});

describe("manager team view", () => {
  it("scopes a branch manager to their own branch (case-insensitive), excluding themselves, and rate-limits nudges", async () => {
    const [bmA, ph] = await Promise.all([db.audience.findUniqueOrThrow({ where: { key: "BRANCH_MANAGER" } }), db.audience.findUniqueOrThrow({ where: { key: "PHARMACIST" } })]);
    const mgr = await mk(`${P}bm@test.local`, { audienceId: bmA.id, branch: "Eng Branch" });
    const mine = await mk(`${P}mine@test.local`, { audienceId: ph.id, branch: "eng branch" });
    const other = await mk(`${P}other@test.local`, { audienceId: ph.id, branch: "Elsewhere" });
    const scope = await managerScope({ id: mgr.id, permissions: new Set() });
    expect(scope).toMatchObject({ kind: "branch", value: "Eng Branch", admin: false });
    const rows = await teamMembers(scope!, mgr.id);
    expect(rows.map((r) => r.id)).toEqual([mine.id]);
    expect(await inScope(scope!, other.id, mgr.id)).toBe(false);
    expect(await inScope(scope!, mgr.id, mgr.id)).toBe(false);
    expect(await managerScope({ id: mine.id, permissions: new Set() })).toBeNull(); // pharmacists have no team view
    expect(await nudge("Manager", mine.id)).toBe(true);
    expect(await nudge("Manager", mine.id)).toBe(false);
    expect(await db.notification.count({ where: { userId: mine.id, type: "reminder" } })).toBe(1);
  });
});

describe("question of the day and points", () => {
  it("draws a stable daily question from completed lessons, scores one answer, and counts points", async () => {
    const u = await mk(`${P}daily@test.local`);
    expect(await getDaily(u.id)).toBeNull(); // nothing learned yet
    const c = await db.course.findUniqueOrThrow({ where: { code: "EG-RET-02" }, include: { lessons: { orderBy: { position: "asc" }, take: 1 } } });
    await enroll(u.id, c.id);
    const q = await db.quiz.findFirstOrThrow({ where: { lessonId: c.lessons[0].id } });
    await takeQuiz(u.id, q.id);
    const d1 = await getDaily(u.id);
    const d2 = await getDaily(u.id);
    expect(d1!.questionId).toBe(d2!.questionId);
    expect(d1!.correctId).toBeNull(); // not revealed before answering
    const right = await db.quizOption.findFirstOrThrow({ where: { questionId: d1!.questionId, isCorrect: true } });
    expect((await answerDaily(u.id, right.id)).correct).toBe(true);
    const wrong = await db.quizOption.findFirstOrThrow({ where: { questionId: d1!.questionId, isCorrect: false } });
    expect(await answerDaily(u.id, wrong.id)).toMatchObject({ correct: true, already: true });
    const d3 = await getDaily(u.id);
    expect(d3).toMatchObject({ answered: true, correct: true, correctId: right.id, streak: 1 });
    const [row] = await leaderboard({ id: u.id });
    expect(row.points).toBe(POINTS.lesson + POINTS.dailyCorrect + POINTS.dailyAnswered);
  });
});
