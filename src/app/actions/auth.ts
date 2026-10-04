"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { clientIp, createSession, destroySession, hashPassword, passwordProblem, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { sendMail } from "@/lib/mail";
import { rateLimit } from "@/lib/ratelimit";
import { hashToken, randomToken } from "@/lib/tokens";
import { getT } from "@/i18n";

type State = { error?: string; ok?: string } | null;
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 12);
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

const registerSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().max(128),
  phone: z.string().trim().max(30).optional(),
  pharmacy: z.string().trim().max(120).optional(),
  terms: z.literal("on"),
});

async function issueToken(userId: string, type: "EMAIL_VERIFY" | "PASSWORD_RESET", ttlMs: number) {
  await db.authToken.deleteMany({ where: { userId, type, usedAt: null } }); // newest token wins
  const token = randomToken();
  await db.authToken.create({ data: { userId, type, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ttlMs) } });
  return token;
}

async function sendVerification(user: { id: string; email: string; firstName: string }) {
  const token = await issueToken(user.id, "EMAIL_VERIFY", 24 * 3600_000);
  await sendMail(user.email, "email_verification", { name: user.firstName, url: `${env.appUrl()}/verify-email?token=${token}` });
}

export async function registerAction(_: State, fd: FormData): Promise<State> {
  const { t } = await getT();
  const ip = await clientIp();
  if (!(await rateLimit(`register:${ip}`, 8, 3600))) return { error: t("auth.locked") };
  const parsed = registerSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Please complete all required fields correctly and accept the terms." };
  const d = parsed.data;
  const problem = passwordProblem(d.password);
  if (problem) return { error: problem };

  const existing = await db.user.findUnique({ where: { email: d.email } });
  if (!existing) {
    const role = await db.role.findUnique({ where: { key: "STUDENT" } });
    const user = await db.user.create({
      data: {
        email: d.email, firstName: d.firstName, lastName: d.lastName, phone: d.phone || null,
        passwordHash: await hashPassword(d.password), status: "PENDING",
        studentProfile: { create: { pharmacyName: d.pharmacy || null } },
        roles: role ? { create: { roleId: role.id } } : undefined,
      },
    });
    await sendVerification(user);
    await audit(user.id, "auth.register", "User", user.id);
  } else if (existing.status === "PENDING") {
    await sendVerification(existing);
  }
  // Identical response whether or not the email existed (prevents account enumeration).
  redirect("/verify-email?sent=1");
}

export async function loginAction(_: State, fd: FormData): Promise<State> {
  const { t } = await getT();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const ip = await clientIp();
  if (!(await rateLimit(`login-ip:${ip}`, 30, 900)) || !(await rateLimit(`login-email:${email}`, 10, 900))) return { error: t("auth.locked") };

  const user = await db.user.findUnique({ where: { email }, include: { roles: { include: { role: true } } } });
  if (!user || user.deletedAt) {
    await verifyPassword(password, DUMMY_HASH);
    return { error: t("auth.invalid") };
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) return { error: t("auth.locked") };
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const failed = user.failedLogins + 1;
    await db.user.update({ where: { id: user.id }, data: { failedLogins: failed, lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null } });
    log("warn", "auth.login_failed", { userId: user.id, ip });
    return { error: t("auth.invalid") };
  }
  if (user.status === "PENDING") return { error: t("auth.unverified") };
  if (user.status !== "ACTIVE") return { error: t("auth.suspended") };

  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await createSession(user.id);
  log("info", "auth.login", { userId: user.id });
  const staff = user.roles.some((r) => ["SUPER_ADMIN", "ADMIN", "INSTRUCTOR", "CONTENT_MANAGER", "SUPPORT"].includes(r.role.key));
  const next = String(fd.get("next") ?? "");
  redirect(/^\/(?![\/\\])/.test(next) ? next : staff ? "/admin" : "/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export async function verifyEmailAction(fd: FormData) {
  const token = String(fd.get("token") ?? "");
  const rec = await db.authToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!rec || rec.type !== "EMAIL_VERIFY" || rec.usedAt || rec.expiresAt < new Date()) redirect("/verify-email?bad=1");
  const user = await db.$transaction(async (tx) => {
    await tx.authToken.update({ where: { id: rec.id }, data: { usedAt: new Date() } });
    // Only PENDING accounts are activated: a suspended/disabled user can't self-reactivate with an old token.
    await tx.user.updateMany({ where: { id: rec.userId, status: "PENDING" }, data: { emailVerifiedAt: new Date(), status: "ACTIVE" } });
    return tx.user.findUniqueOrThrow({ where: { id: rec.userId } });
  });
  void sendMail(user.email, "welcome", { name: user.firstName });
  redirect("/login?verified=1");
}

export async function resendVerificationAction(_: State, fd: FormData): Promise<State> {
  const { t } = await getT();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!(await rateLimit(`resend:${await clientIp()}`, 5, 3600)) || !(await rateLimit(`resend-email:${email}`, 3, 3600))) return { error: t("auth.locked") };
  const user = await db.user.findUnique({ where: { email } });
  if (user && user.status === "PENDING") await sendVerification(user);
  return { ok: t("auth.verify.sent") };
}

export async function forgotPasswordAction(_: State, fd: FormData): Promise<State> {
  const { t } = await getT();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!(await rateLimit(`forgot:${await clientIp()}`, 5, 3600)) || !(await rateLimit(`forgot-email:${email}`, 3, 3600))) return { error: t("auth.locked") };
  const user = await db.user.findUnique({ where: { email } });
  if (user && user.status !== "DISABLED" && !user.deletedAt) {
    const token = await issueToken(user.id, "PASSWORD_RESET", 3600_000);
    await sendMail(user.email, "password_reset", { name: user.firstName, url: `${env.appUrl()}/reset-password?token=${token}` });
  }
  return { ok: t("auth.forgot.sent") };
}

export async function resetPasswordAction(_: State, fd: FormData): Promise<State> {
  const token = String(fd.get("token") ?? "");
  const password = String(fd.get("password") ?? "");
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  const rec = await db.authToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!rec || rec.type !== "PASSWORD_RESET" || rec.usedAt || rec.expiresAt < new Date()) return { error: "This reset link is invalid or has expired." };
  await db.$transaction([
    db.authToken.update({ where: { id: rec.id }, data: { usedAt: new Date() } }),
    db.user.update({ where: { id: rec.userId }, data: { passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null } }),
    db.session.deleteMany({ where: { userId: rec.userId } }), // invalidate all existing sessions
  ]);
  await audit(rec.userId, "auth.password_reset", "User", rec.userId);
  redirect("/login?reset=1");
}
