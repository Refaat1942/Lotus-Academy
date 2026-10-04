import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export const db = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL ?? "postgresql://lotus:lotus_dev_pw@localhost:5432/lotus_academy_test?schema=public" } } });
export const PASSWORD = "Str0ngPassw0rd!";
export const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

/** Replaces the user's one-time token with a known raw value (email delivery is not available in tests). */
export async function plantToken(email: string, type: "EMAIL_VERIFY" | "PASSWORD_RESET", opts: { expired?: boolean } = {}) {
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  await db.authToken.deleteMany({ where: { userId: user.id, type } });
  const raw = crypto.randomBytes(24).toString("base64url");
  await db.authToken.create({ data: { userId: user.id, type, tokenHash: sha(raw), expiresAt: new Date(Date.now() + (opts.expired ? -1000 : 3600_000)) } });
  return raw;
}

export async function ensureUser(email: string, role: string, status: "ACTIVE" | "PENDING" = "ACTIVE") {
  const r = await db.role.findUniqueOrThrow({ where: { key: role } });
  const u = await db.user.upsert({
    where: { email },
    update: { passwordHash: await bcrypt.hash(PASSWORD, 10), status, failedLogins: 0, lockedUntil: null },
    create: { email, firstName: role, lastName: "Tester", passwordHash: await bcrypt.hash(PASSWORD, 10), status, emailVerifiedAt: new Date() },
  });
  await db.userRole.upsert({ where: { userId_roleId: { userId: u.id, roleId: r.id } }, update: {}, create: { userId: u.id, roleId: r.id } });
  return u;
}

export async function resetRateLimits() {
  await db.rateLimit.deleteMany({});
}

import { buildCheckpointPool } from "../../src/lib/domain";
import type { Page } from "@playwright/test";

/** Answers the lesson's current checkpoint correctly (or wrongly) by recomputing the pool from the DB. */
export async function answerCheckpoint(page: Page, userEmail: string, lessonId: string, correct = true) {
  await page.locator("#checkpoint").waitFor();
  const user = await db.user.findUniqueOrThrow({ where: { email: userEmail } });
  const row = await db.lessonCheckpoint.findUniqueOrThrow({ where: { userId_lessonId: { userId: user.id, lessonId } } });
  const qs = await db.quizQuestion.findMany({ where: { quiz: { lessonId } }, orderBy: { position: "asc" }, select: { id: true, promptEn: true, options: { orderBy: { position: "asc" }, select: { id: true, textEn: true, isCorrect: true } } } });
  const pool = buildCheckpointPool(qs).filter((q) => row.questionIds.includes(q.id));
  for (const q of pool) {
    const picks = q.options.filter((o) => (correct ? o.isCorrect : !o.isCorrect)).slice(0, correct ? 9 : 1);
    for (const o of picks) await page.locator(`input[name="q_${q.id}"][value="${o.id}"]`).check();
  }
  await page.getByRole("button", { name: /Submit answer/ }).click();
}
