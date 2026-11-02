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

import type { Page } from "@playwright/test";

/** Answers the currently open attempt shown on the page (correctly, or with wrong options). */
export async function answerOpenAttempt(page: Page, userEmail: string, quizId: string, correct = true) {
  await page.getByRole("button", { name: /Submit answers|إرسال الإجابات/ }).waitFor();
  const user = await db.user.findUniqueOrThrow({ where: { email: userEmail } });
  const attempt = await db.quizAttempt.findFirstOrThrow({ where: { userId: user.id, quizId, submittedAt: null }, orderBy: { startedAt: "desc" } });
  const qs = await db.quizQuestion.findMany({ where: { id: { in: attempt.questionIds } }, include: { options: true } });
  for (const q of qs) {
    const o = q.options.find((x) => (correct ? x.isCorrect : !x.isCorrect))!;
    await page.locator(`input[name="q_${q.id}"][value="${o.id}"]`).check();
  }
  await page.getByRole("button", { name: /Submit answers|إرسال الإجابات/ }).click();
}

/** Completes a lesson through the UI: passes its quiz when it has one, otherwise marks it complete. */
export async function completeLessonUI(page: Page, userEmail: string, courseSlug: string, lessonId: string) {
  const lesson = await db.lesson.findUniqueOrThrow({ where: { id: lessonId } });
  const quiz = await db.quiz.findFirst({ where: { lessonId, status: "PUBLISHED" } });
  if (quiz && lesson.requireCheckpoint) {
    await page.goto(`/learn/${courseSlug}/${lesson.slug}/quiz`);
    await answerOpenAttempt(page, userEmail, quiz.id, true);
    await page.getByRole("heading", { name: "Passed" }).waitFor();
    await page.goto(`/learn/${courseSlug}/${lesson.slug}`);
  } else {
    await page.goto(`/learn/${courseSlug}/${lesson.slug}`);
    await page.getByRole("button", { name: "Mark as complete" }).click();
    await page.getByText("Completed", { exact: true }).first().waitFor();
  }
}

export async function setRegistrationMode(mode: "email" | "approval" | "closed") {
  await db.systemSetting.upsert({ where: { key: "registration.mode" }, update: { value: mode }, create: { key: "registration.mode", value: mode } });
}
