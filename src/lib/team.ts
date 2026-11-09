import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { complianceStatus, type ComplianceStatus } from "./audience";
import type { CurrentUser } from "./auth";

/**
 * Which part of the organisation a manager is responsible for.
 *  - Branch manager     → everyone in the same branch
 *  - Area manager       → everyone in the same area
 *  - Department manager → everyone in the same department
 * Staff with reports.read (training admins) may look at any branch/area/department via filters.
 */
export interface TeamScope { kind: "branch" | "area" | "department" | "all"; value: string | null; admin: boolean }

const eqi = (v: string) => ({ equals: v, mode: "insensitive" as const });

export async function managerScope(user: Pick<CurrentUser, "id" | "permissions">, filter: { branch?: string; area?: string; department?: string } = {}): Promise<TeamScope | null> {
  if (user.permissions.has("reports.read")) {
    if (filter.branch) return { kind: "branch", value: filter.branch, admin: true };
    if (filter.area) return { kind: "area", value: filter.area, admin: true };
    if (filter.department) return { kind: "department", value: filter.department, admin: true };
    return { kind: "all", value: null, admin: true };
  }
  const u = await db.user.findUnique({ where: { id: user.id }, select: { branch: true, area: true, department: true, audience: { select: { key: true } } } });
  switch (u?.audience?.key) {
    case "BRANCH_MANAGER": return u.branch ? { kind: "branch", value: u.branch, admin: false } : null;
    case "AREA_MANAGER": return u.area ? { kind: "area", value: u.area, admin: false } : null;
    case "DEPARTMENT_MANAGER": return u.department ? { kind: "department", value: u.department, admin: false } : null;
    default: return null;
  }
}

export const MANAGER_KEYS = ["BRANCH_MANAGER", "AREA_MANAGER", "DEPARTMENT_MANAGER"];

/** Whether to show "My team" in the navigation. */
export async function hasTeamView(user: Pick<CurrentUser, "id" | "permissions">) {
  if (user.permissions.has("reports.read")) return true;
  return (await db.user.count({ where: { id: user.id, audience: { key: { in: MANAGER_KEYS } } } })) > 0;
}

export function scopeWhere(scope: TeamScope, selfId?: string): Prisma.UserWhereInput {
  const base: Prisma.UserWhereInput = { deletedAt: null, status: "ACTIVE", ...(selfId && !scope.admin ? { id: { not: selfId } } : {}) };
  if (scope.kind === "all" || !scope.value) return base;
  return { ...base, [scope.kind]: eqi(scope.value) };
}

export async function inScope(scope: TeamScope, userId: string, selfId: string) {
  return (await db.user.count({ where: { ...scopeWhere(scope, selfId), id: userId } })) > 0 && (scope.admin || userId !== selfId);
}

export interface MemberRow {
  id: string; name: string; email: string; role: string | null; roleAr: string | null; branch: string | null; area: string | null;
  required: number; requiredDone: number; overdue: number; inProgress: number; avgPercent: number; certificates: number;
  lastActive: Date | null;
}

/** Per-member training summary for a team (one query per table, aggregated in memory). */
export async function teamMembers(scope: TeamScope, selfId: string): Promise<MemberRow[]> {
  const users = await db.user.findMany({
    where: scopeWhere(scope, selfId),
    select: { id: true, firstName: true, lastName: true, email: true, branch: true, area: true, lastLoginAt: true, audience: { select: { nameEn: true, nameAr: true } } },
    orderBy: [{ branch: "asc" }, { firstName: "asc" }],
    take: 5000,
  });
  const ids = users.map((u) => u.id);
  if (!ids.length) return [];
  const [enrollments, progress, certs, lastViewed] = await Promise.all([
    db.enrollment.findMany({ where: { userId: { in: ids }, status: { not: "CANCELLED" } }, select: { userId: true, courseId: true, status: true, dueAt: true, source: true } }),
    db.courseProgress.findMany({ where: { userId: { in: ids } }, select: { userId: true, courseId: true, percent: true } }),
    db.certificate.groupBy({ by: ["userId"], where: { userId: { in: ids }, revokedAt: null }, _count: true }),
    db.lessonProgress.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _max: { lastViewedAt: true } }),
  ]);
  const pm = new Map(progress.map((p) => [`${p.userId}:${p.courseId}`, p.percent]));
  const cm = new Map(certs.map((c) => [c.userId, c._count]));
  const lv = new Map(lastViewed.map((l) => [l.userId, l._max.lastViewedAt]));
  const now = new Date();
  return users.map((u) => {
    const mine = enrollments.filter((e) => e.userId === u.id);
    const req = mine.filter((e) => e.source === "assigned");
    const statuses = mine.map((e) => complianceStatus(e, pm.get(`${u.id}:${e.courseId}`) ?? 0, now));
    const percents = mine.map((e) => pm.get(`${u.id}:${e.courseId}`) ?? 0);
    const last = [u.lastLoginAt, lv.get(u.id) ?? null].filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0] ?? null;
    return {
      id: u.id, name: `${u.firstName} ${u.lastName}`.trim(), email: u.email, role: u.audience?.nameEn ?? null, roleAr: u.audience?.nameAr ?? null,
      branch: u.branch, area: u.area,
      required: req.length, requiredDone: req.filter((e) => e.status === "COMPLETED").length,
      overdue: statuses.filter((s) => s === "OVERDUE").length,
      inProgress: statuses.filter((s) => s === "IN_PROGRESS").length,
      avgPercent: percents.length ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length) : 0,
      certificates: cm.get(u.id) ?? 0,
      lastActive: last,
    };
  });
}

export function teamKpis(rows: MemberRow[]) {
  const required = rows.reduce((s, r) => s + r.required, 0);
  const done = rows.reduce((s, r) => s + r.requiredDone, 0);
  const weekAgo = Date.now() - 7 * 86400_000;
  return {
    members: rows.length,
    compliance: required ? Math.round((done / required) * 100) : 100,
    overdue: rows.reduce((s, r) => s + r.overdue, 0),
    overdueMembers: rows.filter((r) => r.overdue > 0).length,
    avgPercent: rows.length ? Math.round(rows.reduce((s, r) => s + r.avgPercent, 0) / rows.length) : 0,
    certificates: rows.reduce((s, r) => s + r.certificates, 0),
    activeWeek: rows.filter((r) => r.lastActive && r.lastActive.getTime() > weekAgo).length,
  };
}

/** Compliance % per branch (for area/department managers and admins). */
export function byBranch(rows: MemberRow[]) {
  const m = new Map<string, MemberRow[]>();
  for (const r of rows) { const k = r.branch ?? "—"; m.set(k, [...(m.get(k) ?? []), r]); }
  return [...m.entries()].map(([branch, rs]) => ({ branch, area: rs[0].area, ...teamKpis(rs) })).sort((a, b) => a.compliance - b.compliance);
}

export interface MemberCourse { courseId: string; slug: string; title: string; titleAr: string | null; source: string; status: ComplianceStatus; percent: number; dueAt: Date | null; completedAt: Date | null }

export async function memberCourses(userId: string): Promise<MemberCourse[]> {
  const es = await db.enrollment.findMany({ where: { userId, status: { not: "CANCELLED" } }, include: { course: { select: { slug: true, titleEn: true, titleAr: true } } }, orderBy: [{ dueAt: "asc" }, { enrolledAt: "desc" }] });
  const prog = await db.courseProgress.findMany({ where: { userId } });
  const pm = new Map(prog.map((p) => [p.courseId, p.percent]));
  return es.map((e) => ({ courseId: e.courseId, slug: e.course.slug, title: e.course.titleEn, titleAr: e.course.titleAr, source: e.source, status: complianceStatus(e, pm.get(e.courseId) ?? 0), percent: pm.get(e.courseId) ?? 0, dueAt: e.dueAt, completedAt: e.completedAt }));
}
