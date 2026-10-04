import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30000,
    env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://lotus:lotus_dev_pw@localhost:5432/lotus_academy_test?schema=public" },
  },
});
