import { expect, test } from "@playwright/test";
import { PASSWORD, db, ensureUser, resetRateLimits } from "./helpers";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

async function loginAdmin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("brand-admin@e2e.test");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe.serial("logo upload", () => {
  test.beforeAll(async () => { await resetRateLimits(); await ensureUser("brand-admin@e2e.test", "SUPER_ADMIN"); await db.brandAsset.deleteMany({}); });

  test("uploads PNG and SVG logos, rejects fake/malicious files, serves safely", async ({ page, request }) => {
    await loginAdmin(page);
    await page.goto("/admin/settings");
    const logoForm = page.locator("form").filter({ has: page.getByLabel("Logo file") });
    const status = () => page.locator('p[role="status"], p[role="alert"]').first();

    // an executable renamed to .png is rejected by content sniffing
    await page.getByLabel("Logo file").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: Buffer.from("MZ\x90\x00 definitely not an image at all, windows exe") });
    await logoForm.getByRole("button", { name: "Upload" }).click();
    await expect(status()).toContainText("Unsupported file");

    // SVG with a script is rejected
    await page.getByLabel("Logo file").setInputFiles({ name: "x.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') });
    await logoForm.getByRole("button", { name: "Upload" }).click();
    await expect(status()).toContainText("rejected");

    // valid PNG is accepted and shown in the header
    await page.getByLabel("Logo file").setInputFiles({ name: "lotus.png", mimeType: "image/png", buffer: PNG });
    await logoForm.getByRole("button", { name: "Upload" }).click();
    await expect(status()).toContainText("Logo updated");
    await page.goto("/");
    await expect(page.locator('header img[src^="/api/brand/logo"]')).toBeVisible();

    const r = await request.get("/api/brand/logo");
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toBe("image/png");
    expect(r.headers()["x-content-type-options"]).toBe("nosniff");

    // valid SVG replaces it and is served sandboxed
    await page.goto("/admin/settings");
    await page.getByLabel("Logo file").setInputFiles({ name: "lotus.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#006F3C"/></svg>') });
    await logoForm.getByRole("button", { name: "Upload" }).click();
    await expect(status()).toContainText("image/svg+xml");
    const s = await request.get("/api/brand/logo");
    expect(s.headers()["content-type"]).toBe("image/svg+xml");
    expect(s.headers()["content-security-policy"]).toContain("sandbox");
  });

  test("non-admins cannot upload and unknown slots 404", async ({ page, request }) => {
    await ensureUser("brand-student@e2e.test", "STUDENT");
    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByLabel("Email address").fill("brand-student@e2e.test");
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/dashboard/);
    await page.goto("/admin/settings");
    await expect(page).toHaveURL(/dashboard\?denied=1/);
    expect((await request.get("/api/brand/secret")).status()).toBe(404);
  });
});
