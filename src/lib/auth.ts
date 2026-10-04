import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { env } from "./env";
import { hashToken, randomToken } from "./tokens";
import type { PermissionKey } from "./permissions";
import { PERMISSIONS } from "./permissions";

export const SESSION_COOKIE = "la_session";
const SESSION_DAYS = 14;

export { hashPassword, verifyPassword } from "./auth-core";
import { verifyPassword } from "./auth-core";

export { passwordProblem } from "./password";

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function createSession(userId: string) {
  const token = randomToken();
  const h = await headers();
  await db.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      userAgent: h.get("user-agent")?.slice(0, 250),
      ip: await clientIp(),
      expiresAt: new Date(Date.now() + SESSION_DAYS * 86400_000),
    },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.secure(),
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

export interface CurrentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  locale: string;
  roles: string[];
  permissions: Set<string>;
}

/** Resolves the logged-in user from the session cookie. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  const u = session.user;
  if (u.status !== "ACTIVE" || u.deletedAt) return null;
  const roles = u.roles.map((r) => r.role.key);
  const permissions = new Set<string>();
  if (roles.includes("SUPER_ADMIN")) PERMISSIONS.forEach((p) => permissions.add(p));
  for (const r of u.roles) for (const rp of r.role.permissions) permissions.add(rp.permission.key);
  return { id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, locale: u.locale, roles, permissions };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export const can = (user: CurrentUser | null, perm: PermissionKey) => !!user?.permissions.has(perm);

/** Server-side authorization gate: redirects anonymous users, 404s authenticated users lacking the permission. */
export async function requirePermission(perm: PermissionKey): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.permissions.has(perm)) redirect("/dashboard?denied=1");
  return user;
}

/** For server actions: throws instead of redirecting, so a forged call can never proceed. */
export async function assertPermission(perm: PermissionKey): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || !user.permissions.has(perm)) throw new Error("Forbidden");
  return user;
}

export async function assertUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export const isStaff = (u: CurrentUser | null) => !!u && (u.permissions.has("courses.read") || u.permissions.has("users.read"));
