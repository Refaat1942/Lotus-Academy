import type { Prisma } from "@prisma/client";
import { db } from "./db";
import type { CurrentUser } from "./auth";
import { syncPaths } from "./paths";

/** Courses a viewer may see: everything for staff, "ALL" courses for everyone, targeted courses for their audience. */
export function visibleCoursesWhere(user: Pick<CurrentUser, "permissions"> | null, audienceId: string | null): Prisma.CourseWhereInput {
  if (user?.permissions.has("courses.read")) return {};
  const or: Prisma.CourseWhereInput[] = [{ visibility: "ALL" }];
  if (audienceId) or.push({ visibility: "AUDIENCE", audiences: { some: { audienceId } } });
  return { OR: or };
}

export async function audienceOf(userId: string | null | undefined) {
  if (!userId) return null;
  return (await db.user.findUnique({ where: { id: userId }, select: { audienceId: true } }))?.audienceId ?? null;
}

export async function canSeeCourse(user: CurrentUser | null, courseId: string) {
  const where = { id: courseId, ...visibleCoursesWhere(user, await audienceOf(user?.id)) };
  return (await db.course.count({ where })) > 0;
}

const addDays = (d: number) => new Date(Date.now() + d * 86400_000);

/** Enrols learners in the mandatory courses of their audience (idempotent; never re-opens cancelled ones). */
export async function syncAssignments(opts: { userId?: string; courseId?: string } = {}) {
  const links = await db.courseAudience.findMany({
    where: { required: true, ...(opts.courseId ? { courseId: opts.courseId } : {}), course: { status: "PUBLISHED", deletedAt: null } },
    select: { courseId: true, audienceId: true, dueDays: true },
  });
  let created = 0;
  for (const link of links) {
    const users = await db.user.findMany({
      where: { audienceId: link.audienceId, status: "ACTIVE", deletedAt: null, ...(opts.userId ? { id: opts.userId } : {}), enrollments: { none: { courseId: link.courseId } } },
      select: { id: true },
    });
    if (!users.length) continue;
    const total = await db.lesson.count({ where: { courseId: link.courseId, status: "PUBLISHED", deletedAt: null } });
    const dueAt = link.dueDays ? addDays(link.dueDays) : null;
    const r = await db.enrollment.createMany({ data: users.map((u) => ({ userId: u.id, courseId: link.courseId, source: "assigned", dueAt })), skipDuplicates: true });
    await db.courseProgress.createMany({ data: users.map((u) => ({ userId: u.id, courseId: link.courseId, lessonsTotal: total })), skipDuplicates: true });
    await db.notification.createMany({ data: users.map((u) => ({ userId: u.id, type: "assignment", title: "New required course assigned", href: "/dashboard" })) });
    created += r.count;
  }
  // New hires also receive the onboarding paths of their job role.
  if (!opts.courseId) created += await syncPaths({ userId: opts.userId });
  return created;
}

export type ComplianceStatus = "COMPLETED" | "IN_PROGRESS" | "NOT_STARTED" | "OVERDUE";
export function complianceStatus(e: { status: string; dueAt: Date | null }, percent: number, now = new Date()): ComplianceStatus {
  if (e.status === "COMPLETED") return "COMPLETED";
  if (e.dueAt && e.dueAt < now) return "OVERDUE";
  return percent > 0 ? "IN_PROGRESS" : "NOT_STARTED";
}
