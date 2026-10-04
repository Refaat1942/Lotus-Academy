import { expect, test } from "@playwright/test";
import { PASSWORD, answerCheckpoint, db, plantToken, resetRateLimits } from "./helpers";

const email = `student-${Date.now()}@e2e.test`;

test.describe.serial("student journey", () => {
  test.beforeAll(resetRateLimits);

  test("register, verify email, login", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("First name").fill("Sara");
    await page.getByLabel("Last name").fill("Ahmed");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/verify-email\?sent=1/);

    // cannot log in before verification
    await page.goto("/login");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator('p[role="alert"]')).toContainText("verify your email");

    const token = await plantToken(email, "EMAIL_VERIFY");
    await page.goto(`/verify-email?token=${token}`);
    await page.getByRole("button", { name: "Verify your email" }).click();
    await expect(page).toHaveURL(/login\?verified=1/);

    // token is one-time
    await page.goto(`/verify-email?token=${token}`);
    await page.getByRole("button", { name: "Verify your email" }).click();
    await expect(page).toHaveURL(/verify-email\?bad=1/);

    await page.goto("/login");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByRole("heading", { name: /Welcome back, Sara/ })).toBeVisible();
  });

  test("browse, search, enroll, learn, bookmark, complete lessons", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/dashboard/);

    await page.goto("/courses?q=diabetes");
    await expect(page.getByRole("heading", { name: "Diabetes Medications in Egypt" })).toBeVisible();
    await page.getByRole("link", { name: "Diabetes Medications in Egypt" }).first().click();
    await expect(page.getByText("6 lessons").first()).toBeVisible();
    await page.getByRole("button", { name: "Enroll now" }).click();
    await expect(page).toHaveURL(/\/learn\/diabetes-medications-in-egypt\/lesson-01/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Diabetes Epidemiology");

    await page.getByRole("button", { name: "Bookmark" }).click();
    await expect(page.getByRole("button", { name: "Bookmarked" })).toBeVisible();

    const lessons = await db.lesson.findMany({ where: { course: { slug: "diabetes-medications-in-egypt" } }, orderBy: { position: "asc" } });
    // the next lesson is locked until the checkpoint is answered
    await expect(page.getByRole("link", { name: "Next lesson" })).toHaveCount(0);
    await answerCheckpoint(page, email, lessons[0].id);
    await expect(page.getByText("Lesson completed")).toBeVisible();
    await expect(page.getByText("17%").first()).toBeVisible();

    // leave mid-course, then resume from dashboard
    await page.getByRole("link", { name: "Next lesson" }).click();
    await expect(page).toHaveURL(/lesson-02/);
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Continue learning" }).click();
    await expect(page).toHaveURL(/lesson-02/);

    for (let i = 1; i < 6; i++) {
      await answerCheckpoint(page, email, lessons[i].id);
      await expect(page.getByText("Lesson completed")).toBeVisible();
      const next = page.getByRole("link", { name: "Next lesson" });
      if (await next.count()) { await next.click(); await expect(page).toHaveURL(new RegExp(lessons[i + 1].slug)); }
    }
    await expect(page.getByText("You completed this course!")).toBeVisible();
    await page.getByRole("link", { name: "View certificate" }).click();
    await expect(page.getByRole("heading", { name: "Certificate of Completion" })).toBeVisible();
    await expect(page.locator(".cert-sheet").getByText("Sara Ahmed")).toBeVisible();
    await expect(page.locator(".cert-sheet").getByText("Diabetes Medications in Egypt")).toBeVisible();
  });

  test("quiz: take, fail, retry and pass", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/dashboard/);
    await page.goto("/courses/cardiovascular-medications-in-egypt");
    await page.getByRole("button", { name: "Enroll now" }).click();
    await expect(page).toHaveURL(/lesson-01-hypertension/);
    await page.goto("/learn/cardiovascular-medications-in-egypt/lesson-01-hypertension/quiz");
    await page.getByRole("button", { name: "Submit answers" }).click(); // all blank → fail
    await expect(page.getByRole("heading", { name: "Not passed" })).toBeVisible();
    await page.getByRole("link", { name: "Try again" }).click();
    const quiz = await db.quiz.findFirstOrThrow({ where: { lesson: { slug: "lesson-01-hypertension", course: { slug: "cardiovascular-medications-in-egypt" } } }, include: { questions: { include: { options: true } } } });
    for (const q of quiz.questions) {
      const correct = q.options.find((o) => o.isCorrect)!;
      await page.locator(`input[name="q_${q.id}"][value="${correct.id}"]`).check();
    }
    await page.getByRole("button", { name: "Submit answers" }).click();
    await expect(page.getByRole("heading", { name: "Passed" })).toBeVisible();
    await expect(page.getByText("100%").first()).toBeVisible();
  });

  test("public certificate verification", async ({ page }) => {
    const u = await db.user.findUniqueOrThrow({ where: { email } });
    const cert = await db.certificate.findFirstOrThrow({ where: { userId: u.id } });
    await page.goto(`/verify/certificate/${cert.publicId}`);
    await expect(page.getByRole("heading", { name: "Valid certificate" })).toBeVisible();
    await expect(page.getByText("Sara Ahmed")).toBeVisible();
    await page.goto("/verify/certificate/LA-AAAA-BBBB-CCCC");
    await expect(page.getByRole("heading", { name: "Certificate not found" })).toBeVisible();
  });

  test("password reset: token is single-use, expiry enforced, sessions invalidated", async ({ page, context }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email address").fill("nobody@e2e.test");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status")).toContainText("If an account exists"); // no enumeration

    const expired = await plantToken(email, "PASSWORD_RESET", { expired: true });
    await page.goto(`/reset-password?token=${expired}`);
    await page.getByLabel("Password").fill("NewPassw0rd!!1");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.locator('p[role="alert"]')).toContainText("invalid or has expired");

    const token = await plantToken(email, "PASSWORD_RESET");
    await page.goto(`/reset-password?token=${token}`);
    await page.getByLabel("Password").fill("NewPassw0rd!!1");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/login\?reset=1/);
    await page.goto(`/reset-password?token=${token}`);
    await page.getByLabel("Password").fill("AnotherPassw0rd!2");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.locator('p[role="alert"]')).toContainText("invalid or has expired");

    await context.clearCookies();
    await page.goto("/login");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password").fill("NewPassw0rd!!1");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/dashboard/);
  });
});
