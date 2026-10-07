import { expect, test } from "@playwright/test";
import { PASSWORD, db, ensureUser, resetRateLimits } from "./helpers";

const EMAIL = "ar-learner@e2e.test";
const CODE = "EG-RET-01";

test.describe.serial("Arabic lessons and final exam", () => {
  test.beforeAll(async () => {
    await resetRateLimits();
    const u = await ensureUser(EMAIL, "STUDENT");
    const c = await db.course.findUniqueOrThrow({ where: { code: CODE } });
    await db.certificate.deleteMany({ where: { userId: u.id, courseId: c.id } });
    await db.quizAttempt.deleteMany({ where: { userId: u.id } });
    await db.lessonProgress.deleteMany({ where: { userId: u.id } });
    await db.enrollment.deleteMany({ where: { userId: u.id } });
    await db.courseProgress.deleteMany({ where: { userId: u.id } });
    await db.enrollment.create({ data: { userId: u.id, courseId: c.id } });
  });

  async function login(page: import("@playwright/test").Page) {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(EMAIL);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/dashboard/);
  }

  test("lesson renders in Arabic RTL with Arabic objectives and copyright note", async ({ page, context }) => {
    await context.addCookies([{ name: "la_locale", value: "ar", url: "http://localhost:15170" }]);
    await login(page);
    const c = await db.course.findUniqueOrThrow({ where: { code: CODE }, include: { lessons: { orderBy: { position: "asc" } } } });
    const l = c.lessons[0];
    expect(l.bodyMdAr).toBeTruthy();
    await page.goto(`/learn/${c.slug}/${l.slug}`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator(".prose-lotus")).toHaveAttribute("dir", "rtl");
    expect(await page.locator(".prose-lotus").innerText()).toMatch(/[؀-ۿ]{3,}/);
    await expect(page.getByText("صيدليات لوتس — أكاديمية لوتس")).toBeVisible();
  });

  test("final exam is locked until every lesson is complete, then passing it completes the course and issues the certificate", async ({ page }) => {
    await login(page);
    const u = await db.user.findUniqueOrThrow({ where: { email: EMAIL } });
    const c = await db.course.findUniqueOrThrow({ where: { code: CODE }, include: { lessons: { where: { status: "PUBLISHED" }, orderBy: { position: "asc" } } } });
    await page.goto(`/learn/${c.slug}/final-exam`);
    await expect(page).toHaveURL(new RegExp(`/courses/${c.slug}`)); // server-side gate

    const now = new Date();
    for (const l of c.lessons) {
      await db.lessonProgress.upsert({ where: { userId_lessonId: { userId: u.id, lessonId: l.id } }, update: { completedAt: now }, create: { userId: u.id, lessonId: l.id, courseId: c.id, completedAt: now } });
      // pass each lesson quiz directly so only the final exam remains
      const q = await db.quiz.findFirst({ where: { lessonId: l.id, status: "PUBLISHED" } });
      if (q) await db.quizAttempt.create({ data: { userId: u.id, quizId: q.id, scorePct: 100, passed: true, submittedAt: now } });
    }
    await page.goto(`/learn/${c.slug}/final-exam`);
    const exam = await db.quiz.findFirstOrThrow({ where: { courseId: c.id, lessonId: null }, include: { questions: { include: { options: true } } } });
    expect(exam.questions).toHaveLength(20);
    // a wrong attempt fails
    await page.getByRole("button", { name: "Submit answers" }).click();
    await expect(page.getByRole("heading", { name: "Not passed" })).toBeVisible();
    await page.goto(`/learn/${c.slug}/final-exam`);
    for (const q of exam.questions) await page.locator(`input[name="q_${q.id}"][value="${q.options.find((o) => o.isCorrect)!.id}"]`).check();
    await page.getByRole("button", { name: "Submit answers" }).click();
    await expect(page.getByRole("heading", { name: "Passed" })).toBeVisible();
    const e = await db.enrollment.findFirstOrThrow({ where: { userId: u.id, courseId: c.id } });
    expect(e.status).toBe("COMPLETED");
    const cert = await db.certificate.findFirstOrThrow({ where: { userId: u.id, courseId: c.id } });
    await page.goto(`/certificates/${cert.publicId}`);
    await expect(page.locator(".cert-sheet")).toBeVisible();
  });
});
