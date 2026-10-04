import { expect, test } from "@playwright/test";
import { PASSWORD, db, ensureUser, resetRateLimits } from "./helpers";

const adminEmail = "admin@e2e.test";
const title = `E2E Course ${Date.now()}`;

test.describe.serial("admin journey", () => {
  test.beforeAll(async () => { await resetRateLimits(); await ensureUser(adminEmail, "SUPER_ADMIN"); });

  test("login, dashboard, create/edit/publish course and lesson", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(adminEmail);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

    await page.goto("/admin/courses");
    await page.getByLabel("Title (English)").fill(title);
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(page).toHaveURL(/\/admin\/courses\/[a-z0-9]+$/);
    await page.getByLabel("Summary (EN)").fill("An end-to-end test course.");
    await page.getByLabel("Title (AR)").fill("دورة اختبار");
    await page.getByRole("button", { name: "Save course" }).click();
    await expect(page.getByRole("status")).toContainText("Saved");

    await page.getByRole("button", { name: "Add lesson" }).click();
    await expect(page).toHaveURL(/lessons\//);
    await page.getByLabel("Title (EN)").fill("First lesson");
    await page.getByLabel("Content (Markdown)").fill("## Hello\n\nSome **bold** text and a <script>window.__xss=1</script> tag.");
    await page.getByLabel("Duration (min)").fill("30");
    await page.getByLabel("Status").selectOption("PUBLISHED");
    await page.getByRole("button", { name: "Save lesson" }).click();
    await expect(page.getByRole("status")).toContainText("Saved");

    await page.goto("/admin/courses");
    const row = page.getByRole("row", { name: new RegExp(title) });
    await row.getByRole("button", { name: "Publish" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Publish" }).click();
    await expect(row.getByText("PUBLISHED", { exact: true })).toBeVisible();

    await page.goto("/courses?q=" + encodeURIComponent(title));
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  });

  test("reorder lessons, inspect enrollments/reports/audit and export CSV", async ({ page, request }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(adminEmail);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin$/);

    const course = await db.course.findFirstOrThrow({ where: { titleEn: title } });
    await page.goto(`/admin/courses/${course.id}`);
    await page.getByRole("button", { name: "Add lesson" }).click();
    await expect(page).toHaveURL(/lessons\//); // wait for the redirect before navigating away
    await page.goto(`/admin/courses/${course.id}`);
    await page.getByRole("button", { name: /Move New lesson up/ }).click();
    await expect.poll(async () => (await db.lesson.findMany({ where: { courseId: course.id }, orderBy: { position: "asc" } })).map((l) => l.titleEn)).toEqual(["New lesson", "First lesson"]);

    await page.goto("/admin/enrollments");
    await expect(page.getByRole("heading", { name: "Enrollments" })).toBeVisible();
    await page.goto("/admin/reports?range=7d");
    await expect(page.getByText("Quiz pass rate")).toBeVisible();
    await page.goto("/admin/audit?q=course.");
    await expect(page.getByText("course.create").first()).toBeVisible();

    const res = await page.request.get("/api/admin/export/enrollments?range=90d");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");
    expect(await res.text()).toContain("enrolledAt,student,email,course,status,completedAt");
    expect((await request.get("/api/admin/export/users")).status()).toBe(401); // separate (anonymous) context
  });

  test("admin edits imported content and unpublishes", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(adminEmail);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/admin/quizzes");
    await expect(page.getByRole("row", { name: /EG-MED-03/ }).first()).toBeVisible();
    await page.goto("/admin/courses");
    const row = page.getByRole("row", { name: new RegExp(title) });
    await row.getByRole("button", { name: "Unpublish" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Unpublish" }).click();
    await expect(row.getByText("DRAFT", { exact: true })).toBeVisible();
  });
});
