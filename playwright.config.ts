import fs from "node:fs";
import { defineConfig } from "@playwright/test";

const DB = process.env.TEST_DATABASE_URL ?? "postgresql://lotus:lotus_dev_pw@localhost:5432/lotus_academy_test?schema=public";
const PORT = 15170;
// The sandbox ships a Chromium build that may not match this Playwright version; use it when present.
const sandboxChromium = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const executablePath = process.env.PW_CHROMIUM_PATH || (fs.existsSync(sandboxChromium) ? sandboxChromium : undefined);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, launchOptions: { executablePath } },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    env: { DATABASE_URL: DB, APP_URL: `http://localhost:${PORT}`, NODE_ENV: "production", ANTHROPIC_API_KEY: "", ANTHROPIC_AUTH_TOKEN: "" },
  },
});
