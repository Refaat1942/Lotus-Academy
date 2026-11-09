import { expect, test, type Page } from "@playwright/test";
import { PASSWORD, db, ensureUser, resetRateLimits } from "./helpers";

const stamp = Date.now();
const MGR = `e2e-bm-${stamp}@e2e.test`;
const PH = `e2e-ph-${stamp}@e2e.test`;
const BRANCH = `E2E Branch ${stamp}`;

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test.describe.serial("managers, paths, leaderboard, app", () => {
  test.beforeAll(async () => {
    await resetRateLimits();
    const [bm, ph] = await Promise.all([db.audience.findUniqueOrThrow({ where: { key: "BRANCH_MANAGER" } }), db.audience.findUniqueOrThrow({ where: { key: "PHARMACIST" } })]);
    const m = await ensureUser(MGR, "STUDENT");
    await db.user.update({ where: { id: m.id }, data: { audienceId: bm.id, branch: BRANCH, firstName: "Branch", lastName: "Manager" } });
    const p = await ensureUser(PH, "STUDENT");
    await db.user.update({ where: { id: p.id }, data: { audienceId: ph.id, branch: BRANCH, firstName: "Overdue", lastName: "Pharmacist" } });
    const c = await db.course.findUniqueOrThrow({ where: { code: "EG-COM-01" } });
    await db.enrollment.create({ data: { userId: p.id, courseId: c.id, source: "assigned", dueAt: new Date(Date.now() - 3 * 86400_000) } });
  });

  test("a branch manager sees the overdue team member and sends a reminder", async ({ page }) => {
    await login(page, MGR);
    await expect(page.getByRole("link", { name: "My team" }).first()).toBeVisible();
    await page.goto("/team");
    await expect(page.getByRole("heading", { name: "My team's training" })).toBeVisible();
    const row = page.getByRole("row", { name: /Overdue Pharmacist/ });
    await expect(row).toContainText("1 overdue");
    await page.getByRole("button", { name: /Remind all overdue \(1\)/ }).click();
    await expect(page.getByRole("status")).toContainText("Reminder sent to 1");
    await row.getByRole("link", { name: "Overdue Pharmacist" }).click();
    await expect(page.getByText("Overdue", { exact: true }).first()).toBeVisible();
  });

  test("the pharmacist gets the reminder, has no team view, and sees the leaderboard", async ({ page }) => {
    await login(page, PH);
    await page.goto("/dashboard");
    await expect(page.getByText("A reminder from your manager")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Question of the day" })).toBeVisible();
    await page.goto("/team");
    await expect(page.getByText("My team is for managers")).toBeVisible();
    await page.goto("/leaderboard");
    await expect(page.getByRole("heading", { name: "Leaderboard" })).toBeVisible();
    await expect(page.getByText("How to earn points")).toBeVisible();
  });

  test("the app can be installed: manifest and icons", async ({ request }) => {
    const m = await request.get("/manifest.webmanifest");
    expect(m.status()).toBe(200);
    const json = await m.json();
    expect(json.display).toBe("standalone");
    for (const icon of json.icons) {
      const r = await request.get(icon.src);
      expect(r.status(), icon.src).toBe(200);
      expect(r.headers()["content-type"]).toBe("image/png");
    }
    expect((await request.get("/sw.js")).status()).toBe(200);
    expect((await request.get("/offline")).status()).toBe(200);
  });
});
