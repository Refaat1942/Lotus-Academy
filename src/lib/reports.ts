import { db } from "./db";

export type RangeKey = "today" | "7d" | "30d" | "90d" | "custom";

export function parseRange(sp: { range?: string; from?: string; to?: string }) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = 86400_000;
  let from = new Date(now.getTime() - 30 * day);
  let to = now;
  let key: RangeKey = "30d";
  if (sp.range === "today") { from = startOfDay; key = "today"; }
  else if (sp.range === "7d") { from = new Date(now.getTime() - 7 * day); key = "7d"; }
  else if (sp.range === "90d") { from = new Date(now.getTime() - 90 * day); key = "90d"; }
  else if (sp.range === "custom" && sp.from && sp.to) {
    const f = new Date(sp.from), t = new Date(sp.to);
    if (!isNaN(+f) && !isNaN(+t) && f <= t) { from = f; to = new Date(+t + day - 1); key = "custom"; }
  }
  return { from, to, key };
}

/** CSV with spreadsheet-formula injection protection (OWASP): cells starting with = + - @ are prefixed. */
export function toCsv(rows: (string | number | boolean | Date | null | undefined)[][]): string {
  const cell = (v: unknown) => {
    let s = v instanceof Date ? v.toISOString() : v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

export async function overviewStats(from: Date, to: Date) {
  const r = { gte: from, lte: to };
  const [users, verified, active, enrollments, completions, lessonsDone, quizAgg, quizTotal, quizPassed, certIssued, certVerified, emails] = await Promise.all([
    db.user.count({ where: { createdAt: r, deletedAt: null } }),
    db.user.count({ where: { emailVerifiedAt: r } }),
    db.user.count({ where: { lastLoginAt: r } }),
    db.enrollment.count({ where: { enrolledAt: r } }),
    db.enrollment.count({ where: { completedAt: r } }),
    db.lessonProgress.count({ where: { completedAt: r } }),
    db.quizAttempt.aggregate({ where: { submittedAt: r }, _avg: { scorePct: true } }),
    db.quizAttempt.count({ where: { submittedAt: r } }),
    db.quizAttempt.count({ where: { submittedAt: r, passed: true } }),
    db.certificate.count({ where: { issuedAt: r } }),
    db.certificate.aggregate({ _sum: { verifiedCount: true } }),
    db.emailLog.groupBy({ by: ["status"], where: { createdAt: r }, _count: true }),
  ]);
  const avgProgress = await db.courseProgress.aggregate({ _avg: { percent: true } });
  const em = Object.fromEntries(emails.map((e) => [e.status, e._count])) as Record<string, number>;
  return {
    users, verified, active, enrollments, completions, lessonsDone,
    completionRate: enrollments ? Math.round((completions / enrollments) * 100) : 0,
    avgProgress: Math.round(avgProgress._avg.percent ?? 0),
    quizAvg: Math.round(quizAgg._avg.scorePct ?? 0), quizTotal, quizPassRate: quizTotal ? Math.round((quizPassed / quizTotal) * 100) : 0,
    certIssued, certVerified: certVerified._sum.verifiedCount ?? 0,
    emailSent: em.SENT ?? 0, emailFailed: em.FAILED ?? 0,
  };
}

export async function dailySeries(from: Date, to: Date) {
  const rows = await db.$queryRaw<{ d: Date; users: bigint; enrollments: bigint }[]>`
    SELECT d::date AS d,
      (SELECT COUNT(*) FROM "User" u WHERE u."createdAt"::date = d::date) AS users,
      (SELECT COUNT(*) FROM "Enrollment" e WHERE e."enrolledAt"::date = d::date) AS enrollments
    FROM generate_series(${from}::date, ${to}::date, interval '1 day') d ORDER BY d`;
  return rows.map((r) => ({ d: r.d.toISOString().slice(0, 10), users: Number(r.users), enrollments: Number(r.enrollments) }));
}

export async function coursePerformance() {
  const courses = await db.course.findMany({ where: { deletedAt: null }, select: { id: true, code: true, titleEn: true, _count: { select: { enrollments: true } } } });
  const done = await db.enrollment.groupBy({ by: ["courseId"], where: { status: "COMPLETED" }, _count: true });
  const prog = await db.courseProgress.groupBy({ by: ["courseId"], _avg: { percent: true } });
  const dm = new Map(done.map((d) => [d.courseId, d._count]));
  const pm = new Map(prog.map((p) => [p.courseId, Math.round(p._avg.percent ?? 0)]));
  return courses.map((c) => ({ code: c.code ?? "", title: c.titleEn, enrollments: c._count.enrollments, completions: dm.get(c.id) ?? 0, avgProgress: pm.get(c.id) ?? 0 }));
}
