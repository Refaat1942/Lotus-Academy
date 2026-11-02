import { expect, test } from "@playwright/test";
import { PASSWORD, db, ensureUser, resetRateLimits } from "./helpers";

const ADMIN = "tracks-admin@e2e.test";
const NEW = `tracks-bm-${Date.now()}@e2e.test`;

test.describe.serial("job-role tracks and staff onboarding", () => {
  test.beforeAll(async () => { await resetRateLimits(); await ensureUser(ADMIN, "SUPER_ADMIN"); });

  test("admin targets a course to branch managers as mandatory, imports a branch manager, who must change password and sees the required course", async ({ page, browser }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(ADMIN);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin$/);

    const c = await db.course.findUniqueOrThrow({ where: { code: "EG-COM-01" } });
    const bm = await db.audience.findUniqueOrThrow({ where: { key: "BRANCH_MANAGER" } });
    await page.goto(`/admin/courses/${c.id}`);
    await page.getByLabel(`Target ${bm.nameEn}`).check();
    await page.getByLabel(`Mandatory for ${bm.nameEn}`).check();
    await page.getByLabel(`Due days for ${bm.nameEn}`).fill("30");
    await page.getByRole("button", { name: "Save audiences" }).click();
    await expect(page.locator('p[role="status"]').filter({ hasText: "Saved" })).toBeVisible();

    await page.goto("/admin/users/new");
    await page.getByLabel("…or paste CSV").fill(`email,firstName,lastName,jobRole,branch,area\n${NEW},Branch,Manager,BRANCH_MANAGER,Zamalek,Giza\n`);
    await page.getByRole("button", { name: "Import users" }).click();
    await expect(page.getByText("1 created", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Download new accounts (CSV)" })).toBeVisible();

    // the temporary password is only shown once; set a known one for the test
    const u = await db.user.findUniqueOrThrow({ where: { email: NEW } });
    expect(u.mustChangePassword).toBe(true);
    const bcrypt = (await import("bcryptjs")).default;
    await db.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash("TempPassw0rd1", 10) } });

    const ctx = await browser.newContext();
    const p2 = await ctx.newPage();
    await p2.goto("/login");
    await p2.getByLabel("Email address").fill(NEW);
    await p2.getByLabel("Password").fill("TempPassw0rd1");
    await p2.getByRole("button", { name: "Sign in" }).click();
    await expect(p2).toHaveURL(/profile\?mustChange=1/);
    await p2.goto("/dashboard");
    await expect(p2).toHaveURL(/profile\?mustChange=1/); // blocked until the password is changed
    await p2.getByLabel("Current password").fill("TempPassw0rd1");
    await p2.getByLabel("New password").fill("MyOwnPassw0rd9");
    await p2.getByRole("button", { name: "Save" }).last().click();
    await expect(p2.getByText("Password changed")).toBeVisible();
    await p2.goto("/dashboard");
    await expect(p2.getByRole("heading", { name: "Required training" })).toBeVisible();
    await expect(p2.locator("main").getByText(c.titleEn).first()).toBeVisible();
    await ctx.close();

    await page.goto(`/admin/compliance?course=${c.id}&branch=Zamalek`);
    await expect(page.locator(`a[href="/admin/users/${u.id}"]`)).toBeVisible();
    const csv = await page.request.get(`/api/admin/export/compliance?course=${c.id}&branch=Zamalek`);
    expect(csv.status()).toBe(200);
    expect(await csv.text()).toContain(NEW);

    // clean up the targeting so other specs see the default
    await db.courseAudience.deleteMany({ where: { courseId: c.id } });
  });
});
