import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { getT } from "@/i18n";
import { db } from "@/lib/db";
import { overviewStats, parseRange } from "@/lib/reports";
import { AdminTitle } from "@/components/admin";
import { StatCard } from "@/components/ui";

export const metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const user = await requirePermission("courses.read");
  const { t } = await getT();
  const { from, to } = parseRange({});
  const canReport = user.permissions.has("reports.read");
  const [s, courses, drafts, recent] = await Promise.all([
    canReport ? overviewStats(from, to) : null,
    db.course.count({ where: { deletedAt: null } }),
    db.course.count({ where: { status: "DRAFT", deletedAt: null } }),
    user.permissions.has("audit.read") ? db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { actor: true } }) : [],
  ]);
  return (
    <>
      <AdminTitle title={t("admin.overview")} actions={canReport && <Link className="btn-secondary" href="/admin/reports">{t("admin.reports")}</Link>} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Courses" value={courses} hint={`${drafts} draft`} />
        {s && <><StatCard label="New users (30d)" value={s.users} /><StatCard label="Enrollments (30d)" value={s.enrollments} /><StatCard label="Completion rate" value={`${s.completionRate}%`} /><StatCard label="Quiz pass rate" value={`${s.quizPassRate}%`} /><StatCard label="Certificates (30d)" value={s.certIssued} /><StatCard label="Emails failed (30d)" value={s.emailFailed} /><StatCard label="Active learners (30d)" value={s.active} /></>}
      </div>
      {recent.length > 0 && (
        <section className="mt-10"><h2 className="mb-3 font-semibold">{t("admin.audit")}</h2>
          <ul className="card divide-y divide-border text-sm">{recent.map((l) => <li key={l.id} className="flex flex-wrap justify-between gap-2 p-3"><span><strong>{l.action}</strong> <span className="text-muted">{l.entity} {l.actor?.email}</span></span><span className="text-muted">{l.createdAt.toLocaleString()}</span></li>)}</ul></section>
      )}
    </>
  );
}
