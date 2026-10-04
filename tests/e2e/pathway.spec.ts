import { expect, test } from "@playwright/test";
import { PASSWORD, answerCheckpoint, db, ensureUser, resetRateLimits } from "./helpers";

const S1 = "path-student@e2e.test";
const S2 = "path-other@e2e.test";
const ADMIN = "path-admin@e2e.test";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

async function login(page: import("@playwright/test").Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/dashboard|\/admin$/);
}

test.describe.serial("learning path, materials and assistant", () => {
  test.beforeAll(async () => {
    await resetRateLimits();
    await ensureUser(S1, "STUDENT"); await ensureUser(S2, "STUDENT"); await ensureUser(ADMIN, "SUPER_ADMIN");
    const u = await db.user.findUniqueOrThrow({ where: { email: S1 } });
    await db.enrollment.deleteMany({ where: { userId: u.id } });
    await db.lessonCheckpoint.deleteMany({ where: { userId: u.id } });
    await db.lessonProgress.deleteMany({ where: { userId: u.id } });
    await db.chatMessage.deleteMany({ where: { userId: u.id } });
    const c = await db.course.findUniqueOrThrow({ where: { code: "EG-MED-05" } });
    await db.enrollment.create({ data: { userId: u.id, courseId: c.id } });
  });

  test("lessons unlock one by one and only a correct checkpoint answer unlocks the next", async ({ page }) => {
    const lessons = await db.lesson.findMany({ where: { course: { code: "EG-MED-05" } }, orderBy: { position: "asc" }, include: { course: true } });
    await login(page, S1);
    await page.goto(`/learn/${lessons[0].course.slug}/${lessons[1].slug}`);
    await expect(page).toHaveURL(new RegExp(`${lessons[0].slug}\\?locked=1`)); // server redirects back
    await expect(page.getByRole("link", { name: "Next lesson" })).toHaveCount(0);

    await answerCheckpoint(page, S1, lessons[0].id, false);
    await expect(page.locator('p[role="alert"]')).toContainText("Not quite");
    await expect(page.getByRole("link", { name: "Next lesson" })).toHaveCount(0);

    await answerCheckpoint(page, S1, lessons[0].id, true);
    await expect(page.getByText("Lesson completed")).toBeVisible();
    await page.getByRole("link", { name: "Next lesson" }).click();
    await expect(page).toHaveURL(new RegExp(lessons[1].slug));
  });

  test("assistant API: auth, enrollment, lock, validation, origin and search-mode answer", async ({ page, request }) => {
    const lessons = await db.lesson.findMany({ where: { course: { code: "EG-MED-05" } }, orderBy: { position: "asc" } });
    const courseId = lessons[0].courseId;
    const post = (data: unknown, headers: Record<string, string> = {}) => page.request.post("/api/assistant", { data, headers });
    expect((await request.post("/api/assistant", { data: { courseId, lessonId: lessons[0].id, message: "hi" } })).status()).toBe(401);
    await login(page, S1);
    const ok = await post({ courseId, lessonId: lessons[0].id, message: "What are proton pump inhibitors?" });
    expect(ok.status()).toBe(200);
    const j = await ok.json();
    expect(j.mode).toBe("search"); // no API key in the test environment → retrieval fallback
    expect(j.reply.length).toBeGreaterThan(20);
    expect((await post({ courseId, lessonId: lessons[4].id, message: "hi" })).status()).toBe(403); // locked lesson
    expect((await post({ courseId, lessonId: lessons[0].id, message: "x".repeat(1001) })).status()).toBe(400);
    expect((await post({ courseId, lessonId: lessons[0].id, message: "hi" }, { Origin: "https://evil.example" })).status()).toBe(403);
    const hist = await (await page.request.get(`/api/assistant?courseId=${courseId}`)).json();
    expect(hist.messages.length).toBeGreaterThanOrEqual(2);
    await login(page, S2);
    expect((await post({ courseId, lessonId: lessons[0].id, message: "hi" })).status()).toBe(403); // not enrolled
    expect((await page.request.get(`/api/assistant?courseId=${courseId}`)).status()).toBe(403);
  });

  test("admin designs a pathway: module, lessons, move, upload material; access to files is enrolled-only", async ({ page, request }) => {
    await login(page, ADMIN);
    const title = `Path Course ${Date.now()}`;
    await page.goto("/admin/courses");
    await page.getByLabel("Title (English)").fill(title);
    await page.getByLabel("Category").selectOption({ label: "Pediatrics" });
    await page.getByRole("button", { name: "Create course" }).click();
    await expect(page).toHaveURL(/\/admin\/courses\/[a-z0-9]+$/);
    const courseId = page.url().split("/").pop()!;

    await page.getByRole("button", { name: "+ Add module" }).click();
    await expect.poll(() => db.courseModule.count({ where: { courseId } })).toBe(2);
    const mods = await db.courseModule.findMany({ where: { courseId }, orderBy: { position: "asc" } });
    await page.getByRole("button", { name: "+ Add lesson to this module" }).first().click();
    await expect(page).toHaveURL(/lessons\//);
    const lessonId = page.url().split("/").pop()!;
    await page.getByLabel("Title (EN)").fill("Stage one lesson");
    await page.getByLabel("Content (Markdown)").fill("## Intro\n\nHello learners.");
    await page.getByLabel("Status").selectOption("PUBLISHED");
    await page.getByRole("button", { name: "Save lesson" }).click();
    await expect(page.locator('p[role="status"]').first()).toContainText("Saved");

    // upload a PDF material, and reject a fake one
    await page.getByLabel("File", { exact: true }).setInputFiles({ name: "notes.exe.pdf", mimeType: "application/pdf", buffer: Buffer.from("MZ not a pdf at all") });
    await page.getByRole("button", { name: "Upload file" }).click();
    await expect(page.locator('p[role="alert"]')).toContainText("Unsupported");
    await page.getByLabel("File", { exact: true }).setInputFiles({ name: "notes.pdf", mimeType: "application/pdf", buffer: PDF });
    await page.getByLabel("Title (optional)").fill("Lecture notes");
    await page.getByRole("button", { name: "Upload file" }).click();
    await expect(page.locator('p[role="status"]').filter({ hasText: "Uploaded" })).toBeVisible();
    await page.getByLabel("Link title").fill("WHO guideline");
    await page.getByLabel("URL (https)").last().fill("https://www.who.int/");
    await page.getByRole("button", { name: "Add link" }).click();
    await expect(page.locator('p[role="status"]').filter({ hasText: "Link added" })).toBeVisible();

    // move the lesson into the second module through the designer
    await page.goto(`/admin/courses/${courseId}`);
    await page.getByLabel("Module for Stage one lesson").selectOption(mods[1].id);
    await page.getByRole("button", { name: "Move", exact: true }).click();
    await expect.poll(async () => (await db.lesson.findUniqueOrThrow({ where: { id: lessonId } })).moduleId).toBe(mods[1].id);
    await db.course.update({ where: { id: courseId }, data: { status: "PUBLISHED", publishedAt: new Date() } });

    // material downloads: anonymous 401, non-enrolled 403, enrolled 200 as attachment
    const asset = await db.lessonAsset.findFirstOrThrow({ where: { lessonId, kind: "FILE" } });
    expect((await request.get(`/api/files/${asset.fileId}`)).status()).toBe(401);
    const u1 = await db.user.findUniqueOrThrow({ where: { email: S1 } });
    await db.enrollment.upsert({ where: { userId_courseId: { userId: u1.id, courseId } }, update: { status: "ACTIVE" }, create: { userId: u1.id, courseId } });
    await login(page, S2);
    expect((await page.request.get(`/api/files/${asset.fileId}`)).status()).toBe(403);
    await login(page, S1);
    const dl = await page.request.get(`/api/files/${asset.fileId}`);
    expect(dl.status()).toBe(200);
    expect(dl.headers()["content-disposition"]).toContain("attachment");
    expect(dl.headers()["content-type"]).toBe("application/pdf");
    const lesson = await db.lesson.findUniqueOrThrow({ where: { id: lessonId } });
    const course = await db.course.findUniqueOrThrow({ where: { id: courseId } });
    await page.goto(`/learn/${course.slug}/${lesson.slug}`);
    await expect(page.getByRole("link", { name: /Lecture notes/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /WHO guideline/ })).toHaveAttribute("rel", /noopener/);
  });
});
