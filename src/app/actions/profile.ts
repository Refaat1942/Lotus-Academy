"use server";
import { z } from "zod";
import { assertUser, createSession, hashPassword, passwordProblem, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/ratelimit";
import { getT } from "@/i18n";

type State = { error?: string; ok?: string } | null;
const schema = z.object({ firstName: z.string().trim().min(1).max(60), lastName: z.string().trim().min(1).max(60), phone: z.string().trim().max(30).optional(), pharmacy: z.string().trim().max(120).optional() });

export async function updateProfileAction(_: State, fd: FormData): Promise<State> {
  const user = await assertUser();
  const { t } = await getT();
  const p = schema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Please check the fields." };
  await db.user.update({ where: { id: user.id }, data: { firstName: p.data.firstName, lastName: p.data.lastName, phone: p.data.phone || null, studentProfile: { upsert: { create: { pharmacyName: p.data.pharmacy || null }, update: { pharmacyName: p.data.pharmacy || null } } } } });
  return { ok: t("profile.saved") };
}

export async function changePasswordAction(_: State, fd: FormData): Promise<State> {
  const user = await assertUser();
  if (!(await rateLimit(`chpw:${user.id}`, 5, 900))) return { error: "Too many attempts. Try again later." };
  const u = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(String(fd.get("current") ?? ""), u.passwordHash))) return { error: "Current password is incorrect." };
  const next = String(fd.get("password") ?? "");
  const problem = passwordProblem(next);
  if (problem) return { error: problem };
  await db.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(next) } });
  await db.session.deleteMany({ where: { userId: u.id } }); // end every other session
  await createSession(u.id);
  await audit(u.id, "auth.password_change", "User", u.id);
  return { ok: "Password changed." };
}
