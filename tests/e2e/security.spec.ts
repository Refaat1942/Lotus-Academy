import { expect, test } from "@playwright/test";
import { PASSWORD, db, ensureUser, resetRateLimits } from "./helpers";

const A = "sec-a@e2e.test";
const B = "sec-b@e2e.test";

async function login(page: import("@playwright/test").Page, email: string, pw = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(pw);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.beforeAll(async () => { await resetRateLimits(); await ensureUser(A, "STUDENT"); await ensureUser(B, "STUDENT"); await ensureUser("sec-admin@e2e.test", "ADMIN"); await ensureUser("sec-support@e2e.test", "SUPPORT"); });

test("anonymous users are redirected from protected pages and APIs", async ({ page, request }) => {
  for (const p of ["/admin", "/admin/users", "/dashboard", "/profile", "/learn/diabetes-medications-in-egypt/lesson-01-epidemiology-targets"]) {
    await page.goto(p);
    await expect(page).toHaveURL(/\/login/);
  }
  for (const t of ["users", "enrollments", "audit", "emails"]) expect((await request.get(`/api/admin/export/${t}`)).status()).toBe(401);
});

test("students cannot reach admin pages or exports (broken access control)", async ({ page }) => {
  await login(page, A);
  await expect(page).toHaveURL(/dashboard/);
  for (const p of ["/admin", "/admin/users", "/admin/audit", "/admin/settings", "/admin/courses"]) {
    await page.goto(p);
    await expect(page).toHaveURL(/dashboard\?denied=1/);
  }
  for (const t of ["users", "enrollments", "audit", "courses"]) expect((await page.request.get(`/api/admin/export/${t}`)).status()).toBe(403);
  expect((await page.request.get("/api/admin/export/nope")).status()).toBe(404);
});

test("role boundaries: ADMIN cannot manage roles; SUPPORT is read-only", async ({ page }) => {
  await login(page, "sec-admin@e2e.test");
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/users");
  await expect(page.getByRole("button", { name: /^\+ INSTRUCTOR/ })).toHaveCount(0); // no role-management controls without roles.write
  await page.context().clearCookies();
  await login(page, "sec-support@e2e.test");
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/settings");
  await expect(page).toHaveURL(/dashboard\?denied=1/);
  await page.goto("/admin/courses");
  await expect(page.getByRole("button", { name: "Publish" })).toHaveCount(0);
  await expect(page.getByLabel("Title (English)")).toHaveCount(0);
  expect((await page.request.get("/api/admin/export/audit")).status()).toBe(403);
});

test("IDOR: users cannot read another user's certificate or quiz result", async ({ page, browser }) => {
  const a = await db.user.findUniqueOrThrow({ where: { email: A } });
  const course = await db.course.findUniqueOrThrow({ where: { code: "EG-MED-05" } });
  await db.certificate.deleteMany({ where: { userId: a.id, courseId: course.id } });
  const cert = await db.certificate.create({ data: { publicId: `LA-TEST-${Math.random().toString(36).slice(2, 6).toUpperCase().replace(/[01OIL]/g, "X")}-ZZZZ`, userId: a.id, courseId: course.id, recipientName: "A User", courseTitle: "X" } });
  const quiz = await db.quiz.findFirstOrThrow({ where: { courseId: course.id } });
  await db.quizAttempt.deleteMany({ where: { userId: a.id, quizId: quiz.id } });
  const attempt = await db.quizAttempt.create({ data: { userId: a.id, quizId: quiz.id, scorePct: 50, submittedAt: new Date() } });
  await login(page, B);
  await expect(page).toHaveURL(/dashboard/);
  expect((await page.goto(`/certificates/${cert.publicId}`))!.status()).toBe(404);
  expect((await page.goto(`/quiz-result/${attempt.id}`))!.status()).toBe(404);
  // sanity: the owner can see them
  const ctx = await browser.newContext();
  const p2 = await ctx.newPage();
  await login(p2, A);
  await expect(p2).toHaveURL(/dashboard/);
  expect((await p2.goto(`/quiz-result/${attempt.id}`))!.status()).toBe(200);
  await ctx.close();
});

test("learners cannot open lessons of courses they are not enrolled in", async ({ page }) => {
  const u = await db.user.findUniqueOrThrow({ where: { email: B } });
  await db.enrollment.deleteMany({ where: { userId: u.id } });
  await login(page, B);
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/learn/pediatric-medications-in-egypt/lesson-01-dosing-formulations");
  await expect(page).toHaveURL(/\/courses\/pediatric-medications-in-egypt$/);
});

test("invalid/forged sessions and tokens are rejected", async ({ page, context }) => {
  await context.addCookies([{ name: "la_session", value: "forged-token-value", url: "http://localhost:15170" }]);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/verify-email?token=not-a-real-token");
  await page.getByRole("button", { name: "Verify your email" }).click();
  await expect(page).toHaveURL(/bad=1/);
  await page.goto("/reset-password?token=garbage");
  await page.getByLabel("Password").fill("ValidPassw0rd!!");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.locator('p[role="alert"]')).toContainText("invalid or has expired");
});

test("injection payloads are inert (SQLi / XSS)", async ({ page }) => {
  const res = await page.goto("/courses?q=" + encodeURIComponent("' OR 1=1; DROP TABLE \"Course\"; --"));
  expect(res!.status()).toBe(200);
  await expect(page.getByText("No courses match your filters.")).toBeVisible();
  expect(await db.course.count()).toBeGreaterThan(5);
  await page.goto("/courses?q=" + encodeURIComponent("<script>window.__x=1</script>"));
  expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined();
  await page.goto("/verify/certificate/" + encodeURIComponent("LA-1' OR '1'='1"));
  await expect(page.getByRole("heading", { name: "Certificate not found" })).toBeVisible();

  // stored XSS through the profile name is escaped on render
  await login(page, A);
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/profile");
  await page.getByLabel("First name").fill('<img src=x onerror="window.__x2=1">');
  await page.getByRole("button", { name: "Save" }).first().click();
  await expect(page.getByRole("status")).toContainText("Profile saved");
  await page.goto("/dashboard");
  expect(await page.evaluate(() => (window as unknown as { __x2?: number }).__x2)).toBeUndefined();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("<img src=x");
});

test("lesson markdown cannot execute scripts", async ({ page }) => {
  const course = await db.course.findUniqueOrThrow({ where: { code: "EG-MED-08" } });
  const lesson = await db.lesson.findFirstOrThrow({ where: { courseId: course.id }, orderBy: { position: "asc" } });
  const orig = lesson.bodyMd;
  await db.lesson.update({ where: { id: lesson.id }, data: { bodyMd: `## x\n\n<script>window.__x3=1</script><img src=x onerror="window.__x3=1"> [a](javascript:window.__x3=1)\n\n${orig}` } });
  const u = await db.user.findUniqueOrThrow({ where: { email: A } });
  await db.enrollment.upsert({ where: { userId_courseId: { userId: u.id, courseId: course.id } }, update: { status: "ACTIVE" }, create: { userId: u.id, courseId: course.id } });
  await login(page, A);
  await expect(page).toHaveURL(/dashboard/);
  await page.goto(`/learn/${course.slug}/${lesson.slug}`);
  expect(await page.evaluate(() => (window as unknown as { __x3?: number }).__x3)).toBeUndefined();
  expect(await page.locator(".prose-lotus script, .prose-lotus img").count()).toBe(0);
  await db.lesson.update({ where: { id: lesson.id }, data: { bodyMd: orig } });
});

test("login rate limiting / account lockout, no user enumeration", async ({ page }) => {
  await resetRateLimits();
  await login(page, "does-not-exist@e2e.test", "whatever12345");
  const unknown = await page.locator('p[role="alert"]').innerText();
  await login(page, A, "wrong-password-1");
  expect(await page.locator('p[role="alert"]').innerText()).toBe(unknown); // identical message
  let last = "";
  for (let i = 0; i < 12; i++) { await login(page, A, `bad-password-${i}`); last = await page.locator('p[role="alert"]').innerText(); }
  expect(last).toContain("Too many attempts");
  await login(page, A, PASSWORD); // correct password is also refused while locked
  await expect(page).toHaveURL(/\/login/);
  await resetRateLimits();
  await db.user.update({ where: { email: A }, data: { failedLogins: 0, lockedUntil: null } });
});

test("open redirect is blocked and security headers are present", async ({ page, request }) => {
  await resetRateLimits();
  await page.goto("/login?next=//evil.example.com");
  await page.getByLabel("Email address").fill(B);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/localhost:15170\/dashboard/);
  const h = (await request.get("/")).headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("path traversal and sensitive files are not served", async ({ request }) => {
  for (const p of ["/brand/../../.env", "/..%2f..%2f.env", "/.env", "/_next/../package.json", "/prisma/schema.prisma", "/content/sources/Course-01-cardiovascular.zip"]) {
    const r = await request.get(p);
    expect([400, 404], p).toContain(r.status());
  }
});

test("unpublished courses are hidden from the public", async ({ request }) => {
  const c = await db.course.create({ data: { slug: `hidden-${Date.now()}`, titleEn: "Hidden draft", status: "DRAFT" } });
  expect((await request.get(`/courses/${c.slug}`)).status()).toBe(404);
});
