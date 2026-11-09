import { db } from "./db";

const day = 86400_000;

/** Enrols a learner in a path and in every course of it (as assigned training). Idempotent. */
export async function assignPath(userId: string, pathId: string, now = new Date()) {
  const path = await db.learningPath.findUnique({ where: { id: pathId }, include: { courses: { orderBy: { position: "asc" }, include: { course: { select: { id: true, status: true, deletedAt: true } } } } } });
  if (!path) throw new Error("Path not found");
  const exists = await db.pathEnrollment.findUnique({ where: { userId_pathId: { userId, pathId } } });
  if (exists) return false;
  const dueAt = path.dueDays ? new Date(now.getTime() + path.dueDays * day) : null;
  const courses = path.courses.filter((c) => c.course.status === "PUBLISHED" && !c.course.deletedAt).map((c) => c.courseId);
  await db.$transaction(async (tx) => {
    await tx.pathEnrollment.create({ data: { userId, pathId, dueAt, startedAt: now } });
    for (const courseId of courses) {
      const e = await tx.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
      if (e) {
        if (e.status === "CANCELLED") await tx.enrollment.update({ where: { id: e.id }, data: { status: "ACTIVE", source: "assigned", dueAt } });
        else if (e.status !== "COMPLETED" && !e.dueAt && dueAt) await tx.enrollment.update({ where: { id: e.id }, data: { dueAt, source: "assigned" } });
        continue;
      }
      const total = await tx.lesson.count({ where: { courseId, status: "PUBLISHED", deletedAt: null } });
      await tx.enrollment.create({ data: { userId, courseId, source: "assigned", dueAt, enrolledAt: now } });
      await tx.courseProgress.upsert({ where: { userId_courseId: { userId, courseId } }, update: {}, create: { userId, courseId, lessonsTotal: total } });
    }
    await tx.notification.create({ data: { userId, type: "assignment", title: `Learning path assigned: ${path.titleEn}`, href: `/paths/${path.slug}` } });
  });
  await refreshPathCompletion(userId);
  return true;
}

/**
 * New hires: published paths flagged "auto-assign" are given to active staff of the path's job role
 * (or everyone, when the path has no role) whose account was created after the path.
 */
export async function syncPaths(opts: { userId?: string } = {}) {
  const paths = await db.learningPath.findMany({ where: { published: true, autoAssignNewHires: true } });
  let n = 0;
  for (const p of paths) {
    const users = await db.user.findMany({
      where: { status: "ACTIVE", deletedAt: null, createdAt: { gte: p.createdAt }, ...(p.audienceId ? { audienceId: p.audienceId } : {}), ...(opts.userId ? { id: opts.userId } : {}), pathEnrollments: { none: { pathId: p.id } }, roles: { every: { role: { key: "STUDENT" } } } },
      select: { id: true },
    });
    for (const u of users) if (await assignPath(u.id, p.id)) n++;
  }
  return n;
}

/** Assigns a path to every current active member of its job role (admin action for existing staff). */
export async function assignPathToRole(pathId: string) {
  const p = await db.learningPath.findUniqueOrThrow({ where: { id: pathId } });
  const users = await db.user.findMany({ where: { status: "ACTIVE", deletedAt: null, ...(p.audienceId ? { audienceId: p.audienceId } : {}), pathEnrollments: { none: { pathId } }, roles: { every: { role: { key: "STUDENT" } } } }, select: { id: true } });
  let n = 0;
  for (const u of users) if (await assignPath(u.id, pathId)) n++;
  return n;
}

export interface PathStep { courseId: string; slug: string; titleEn: string; titleAr: string | null; durationMinutes: number; categorySlug: string | null; percent: number; done: boolean; locked: boolean; current: boolean }

export function stepsFor(courses: { courseId: string; course: { slug: string; titleEn: string; titleAr: string | null; durationMinutes: number; category: { slug: string } | null } }[], completed: Set<string>, percent: Map<string, number>): PathStep[] {
  let blocked = false;
  let currentSet = false;
  return courses.map((c) => {
    const done = completed.has(c.courseId);
    const locked = blocked;
    if (!done) blocked = true;
    const current = !done && !locked && !currentSet;
    if (current) currentSet = true;
    return { courseId: c.courseId, slug: c.course.slug, titleEn: c.course.titleEn, titleAr: c.course.titleAr, durationMinutes: c.course.durationMinutes, categorySlug: c.course.category?.slug ?? null, percent: done ? 100 : percent.get(c.courseId) ?? 0, done, locked, current };
  });
}

const pathInclude = { courses: { orderBy: { position: "asc" as const }, include: { course: { select: { slug: true, titleEn: true, titleAr: true, durationMinutes: true, status: true, deletedAt: true, category: { select: { slug: true } } } } } } };

/** The learner's paths with per-course steps (done / current / locked). */
export async function myPaths(userId: string) {
  const pes = await db.pathEnrollment.findMany({ where: { userId }, include: { path: { include: pathInclude } }, orderBy: { startedAt: "asc" } });
  if (!pes.length) return [];
  const [enr, prog] = await Promise.all([
    db.enrollment.findMany({ where: { userId, status: "COMPLETED" }, select: { courseId: true } }),
    db.courseProgress.findMany({ where: { userId }, select: { courseId: true, percent: true } }),
  ]);
  const completed = new Set(enr.map((e) => e.courseId));
  const pm = new Map(prog.map((p) => [p.courseId, p.percent]));
  return pes.map((pe) => {
    const steps = stepsFor(pe.path.courses.filter((c) => c.course.status === "PUBLISHED" && !c.course.deletedAt), completed, pm);
    const percent = steps.length ? Math.round(steps.reduce((s, x) => s + x.percent, 0) / steps.length) : 0;
    return { enrollment: pe, path: pe.path, steps, percent };
  });
}

/** If the course sits in one of the learner's paths behind an unfinished course, returns that blocker. */
export async function pathBlocker(userId: string, courseId: string) {
  const paths = await myPaths(userId);
  for (const p of paths) {
    const i = p.steps.findIndex((s) => s.courseId === courseId);
    if (i > 0 && p.steps[i].locked) {
      const blocker = p.steps.slice(0, i).find((s) => !s.done)!;
      return { path: p.path, blocker };
    }
  }
  return null;
}

export async function refreshPathCompletion(userId: string) {
  for (const p of await myPaths(userId)) {
    const complete = p.steps.length > 0 && p.steps.every((s) => s.done);
    if (complete && !p.enrollment.completedAt) {
      await db.pathEnrollment.update({ where: { id: p.enrollment.id }, data: { completedAt: new Date() } });
      await db.notification.create({ data: { userId, type: "path", title: `Learning path completed: ${p.path.titleEn}`, href: `/paths/${p.path.slug}` } });
    }
  }
}

/** Server-side guard for learning pages: a course behind an unfinished path step redirects to the path. */
export async function enforcePathOrder(userId: string, courseId: string) {
  const b = await pathBlocker(userId, courseId);
  if (b) {
    const { redirect } = await import("next/navigation");
    redirect(`/paths/${b.path.slug}?locked=1`);
  }
}
