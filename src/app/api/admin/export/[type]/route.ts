import { getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { coursePerformance, parseRange, toCsv } from "@/lib/reports";
import type { PermissionKey } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const NEEDS: Record<string, PermissionKey> = { users: "users.read", enrollments: "enrollments.read", courses: "reports.read", certificates: "certificates.read", emails: "emails.read", audit: "audit.read", quizzes: "reports.read" };

export async function GET(req: Request, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const perm = NEEDS[type];
  if (!perm) return new Response("Not found", { status: 404 });
  if (!user.permissions.has(perm)) return new Response("Forbidden", { status: 403 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const { from, to } = parseRange(sp);
  const r = { gte: from, lte: to };
  let rows: (string | number | boolean | Date | null)[][] = [];
  if (type === "users") {
    const us = await db.user.findMany({ where: { createdAt: r, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 50000, include: { roles: { include: { role: true } } } });
    rows = [["id", "email", "firstName", "lastName", "status", "roles", "createdAt", "verifiedAt"], ...us.map((u) => [u.id, u.email, u.firstName, u.lastName, u.status, u.roles.map((x) => x.role.key).join("|"), u.createdAt, u.emailVerifiedAt])];
  } else if (type === "enrollments") {
    const es = await db.enrollment.findMany({ where: { enrolledAt: r }, orderBy: { enrolledAt: "desc" }, take: 50000, include: { user: true, course: true } });
    rows = [["enrolledAt", "student", "email", "course", "status", "completedAt"], ...es.map((e) => [e.enrolledAt, `${e.user.firstName} ${e.user.lastName}`, e.user.email, e.course.titleEn, e.status, e.completedAt])];
  } else if (type === "courses") {
    rows = [["code", "course", "enrollments", "completions", "avgProgress"], ...(await coursePerformance()).map((c) => [c.code, c.title, c.enrollments, c.completions, c.avgProgress])];
  } else if (type === "certificates") {
    const cs = await db.certificate.findMany({ where: { issuedAt: r }, orderBy: { issuedAt: "desc" }, take: 50000 });
    rows = [["certificateId", "recipient", "course", "issuedAt", "revoked", "verifications"], ...cs.map((c) => [c.publicId, c.recipientName, c.courseTitle, c.issuedAt, !!c.revokedAt, c.verifiedCount])];
  } else if (type === "emails") {
    const es = await db.emailLog.findMany({ where: { createdAt: r }, orderBy: { createdAt: "desc" }, take: 50000 });
    rows = [["createdAt", "recipient", "template", "subject", "provider", "status", "error", "retries"], ...es.map((e) => [e.createdAt, e.recipient, e.template, e.subject, e.provider, e.status, e.error, e.retryCount])];
  } else if (type === "quizzes") {
    const as = await db.quizAttempt.findMany({ where: { submittedAt: r }, orderBy: { submittedAt: "desc" }, take: 50000, include: { user: true, quiz: true } });
    rows = [["submittedAt", "student", "quiz", "score", "passed"], ...as.map((a) => [a.submittedAt, a.user.email, a.quiz.titleEn, a.scorePct, a.passed])];
  } else {
    const ls = await db.auditLog.findMany({ where: { createdAt: r }, orderBy: { createdAt: "desc" }, take: 50000, include: { actor: true } });
    rows = [["createdAt", "actor", "action", "entity", "entityId"], ...ls.map((l) => [l.createdAt, l.actor?.email ?? "", l.action, l.entity, l.entityId])];
  }
  await audit(user.id, "export.csv", "Export", type, { rows: rows.length - 1 });
  return new Response(toCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="lotus-${type}-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
}
