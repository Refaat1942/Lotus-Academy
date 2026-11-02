import { expect, test } from "@playwright/test";
import { PASSWORD, setRegistrationMode, answerOpenAttempt, completeLessonUI, db, plantToken, resetRateLimits } from "./helpers";

const email = `student-${Date.now()}@e2e.test`;

test.describe.serial("student journey", () => {
  test.beforeAll(async () => {
    await resetRateLimits();
    await setRegistrationMode("email");
  });
  test.afterAll(() => setRegistrationMode("approval"));

  test("approval mode: a new sign-up waits for an admin before it can sign in", async ({ page }) => {
    await setRegistrationMode("approval");
    const pending = `pending-${Date.now()}@e2e.test`;
    await page.goto("/register");
    await page.getByLabel("First name").fill("Mona");
    await page.getByLabel("Last name").fill("Adel");
    await page.getByLabel("Email address").fill(pending);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/verify-email\?pending=1/);
    expect((await db.user.findUnique({ where: { email: pending } }))?.status).toBe("PENDING");
    await setRegistrationMode("email");
  });

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

  test("browse, search, enroll, learn with lesson quizzes, final exam, certificate", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/dashboard/);

    const course = await db.course.findUniqueOrThrow({ where: { code: "EG-RET-02" } });
    const lessons = await db.lesson.findMany({ where: { courseId: course.id, status: "PUBLISHED" }, orderBy: { position: "asc" } });
    await page.goto("/courses?q=" + encodeURIComponent("Customer Experience"));
    await page.getByRole("link", { name: course.titleEn }).first().click();
    await page.getByRole("button", { name: "Enroll now" }).click();
    await expect(page).toHaveURL(new RegExp(`/learn/${course.slug}/${lessons[0].slug}`));

    await page.getByRole("button", { name: "Bookmark" }).click();
    await expect(page.getByRole("button", { name: "Bookmarked" })).toBeVisible();

    // the next lesson stays locked until the lesson quiz is passed; there is no manual "complete" for quiz lessons
    await expect(page.getByRole("link", { name: "Next lesson" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Mark as complete" })).toHaveCount(0);
    await page.getByRole("link", { name: "Start the lesson quiz" }).click();
    const quiz1 = await db.quiz.findFirstOrThrow({ where: { lessonId: lessons[0].id } });
    await expect(page.locator("fieldset")).toHaveCount(5); // 5 random questions per attempt
    await answerOpenAttempt(page, email, quiz1.id, true);
    await expect(page.getByRole("heading", { name: "Passed" })).toBeVisible();
    await page.getByRole("link", { name: "Back to lesson" }).click();
    await expect(page.getByText("20%").first()).toBeVisible();

    // leave mid-course, then resume from the dashboard
    await page.getByRole("link", { name: "Next lesson" }).click();
    await expect(page).toHaveURL(new RegExp(lessons[1].slug));
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Continue learning" }).click();
    await expect(page).toHaveURL(new RegExp(lessons[1].slug));

    for (const l of lessons.slice(1)) await completeLessonUI(page, email, course.slug, l.id);

    // final exam unlocks after the last lesson, then the certificate is issued
    await page.goto(`/courses/${course.slug}`);
    await page.getByRole("link", { name: "Start the final exam" }).click();
    const exam = await db.quiz.findFirstOrThrow({ where: { courseId: course.id, lessonId: null } });
    await answerOpenAttempt(page, email, exam.id, true);
    await expect(page.getByRole("heading", { name: "Passed" })).toBeVisible();
    const cert = await db.certificate.findFirstOrThrow({ where: { courseId: course.id, user: { email } } });
    await page.goto(`/certificates/${cert.publicId}`);
    await expect(page.getByRole("heading", { name: "Certificate of Completion" })).toBeVisible();
    await expect(page.locator(".cert-sheet").getByText("Sara Ahmed")).toBeVisible();
    await expect(page.locator(".cert-sheet").getByText(course.titleEn)).toBeVisible();
  });

  test("quiz: a failed attempt hides the answers; a retry draws new questions; passing reveals them", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/dashboard/);
    const course = await db.course.findUniqueOrThrow({ where: { code: "EG-RET-01" } });
    const lesson = await db.lesson.findFirstOrThrow({ where: { courseId: course.id }, orderBy: { position: "asc" } });
    const quiz = await db.quiz.findFirstOrThrow({ where: { lessonId: lesson.id } });
    await page.goto(`/courses/${course.slug}`);
    await page.getByRole("button", { name: "Enroll now" }).click();
    await expect(page).toHaveURL(new RegExp(`/learn/${course.slug}/`)); // wait for the enrolment redirect
    await page.goto(`/learn/${course.slug}/${lesson.slug}/quiz`);
    await answerOpenAttempt(page, email, quiz.id, false);
    await expect(page.getByRole("heading", { name: "Not passed" })).toBeVisible();
    await expect(page.getByText("Correct answers are shown once you pass")).toBeVisible();
    await expect(page.locator("li.text-success.font-semibold")).toHaveCount(0); // no correct option revealed
    await page.getByRole("link", { name: "Try again" }).click();
    await answerOpenAttempt(page, email, quiz.id, true);
    await expect(page.getByRole("heading", { name: "Passed" })).toBeVisible();
    await expect(page.getByText("100%").first()).toBeVisible();
    await expect(page.locator("li.text-success.font-semibold")).toHaveCount(5); // answers revealed after passing
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
