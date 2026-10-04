import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/i18n";
import { AdminTitle, Table, Td, hrefWith } from "@/components/admin";
import { Badge, Pagination } from "@/components/ui";
import { ConfirmAction } from "@/components/ConfirmAction";
import { cancelEnrollmentAction } from "@/app/actions/admin";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
const SIZE = 25;

export default async function Enrollments({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requirePermission("enrollments.read");
  const sp = await searchParams;
  const { t } = await getT();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const where: Prisma.EnrollmentWhereInput = {};
  if (sp.status && ["ACTIVE", "COMPLETED", "CANCELLED"].includes(sp.status)) where.status = sp.status as "ACTIVE";
  if (sp.courseId) where.courseId = sp.courseId;
  if (sp.q) where.user = { OR: [{ email: { contains: sp.q, mode: "insensitive" } }, { firstName: { contains: sp.q, mode: "insensitive" } }, { lastName: { contains: sp.q, mode: "insensitive" } }] };
  const [total, rows, courses] = await Promise.all([
    db.enrollment.count({ where }),
    db.enrollment.findMany({ where, orderBy: { enrolledAt: "desc" }, skip: (page - 1) * SIZE, take: SIZE, include: { user: true, course: { select: { titleEn: true } } } }),
    db.course.findMany({ select: { id: true, titleEn: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const prog = await db.courseProgress.findMany({ where: { OR: rows.map((r) => ({ userId: r.userId, courseId: r.courseId })) } });
  const pm = new Map(prog.map((p) => [`${p.userId}:${p.courseId}`, p.percent]));
  return (
    <>
      <AdminTitle title={t("admin.enrollments")} actions={<a className="btn-secondary" href="/api/admin/export/enrollments?range=90d">{t("common.export")}</a>} />
      <form method="get" role="search" className="mb-4 flex flex-wrap gap-3">
        <input name="q" defaultValue={sp.q} placeholder={t("common.search")} aria-label={t("common.search")} className="input max-w-xs" />
        <select name="courseId" defaultValue={sp.courseId ?? ""} aria-label="Course" className="input max-w-xs"><option value="">{t("common.all")}</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.titleEn}</option>)}</select>
        <select name="status" defaultValue={sp.status ?? ""} aria-label="Status" className="input max-w-[11rem]"><option value="">{t("common.all")}</option><option>ACTIVE</option><option>COMPLETED</option><option>CANCELLED</option></select>
        <button className="btn-primary" type="submit">{t("common.search")}</button>
      </form>
      <Table caption={t("admin.enrollments")} head={["Student", "Course", "Enrolled", "Progress", t("common.status"), t("common.actions")]}>
        {rows.map((e) => (
          <tr key={e.id}><Td>{e.user.firstName} {e.user.lastName}<div className="text-xs text-muted">{e.user.email}</div></Td><Td>{e.course.titleEn}</Td><Td className="text-muted">{e.enrolledAt.toLocaleDateString()}</Td>
            <Td>{pm.get(`${e.userId}:${e.courseId}`) ?? 0}%</Td><Td><Badge tone={e.status === "COMPLETED" ? "success" : e.status === "ACTIVE" ? "primary" : "neutral"}>{e.status}</Badge></Td>
            <Td>{me.permissions.has("enrollments.write") && e.status !== "CANCELLED" && <ConfirmAction action={cancelEnrollmentAction} fields={{ id: e.id }} label="Cancel" message="Cancel this enrollment? The learner loses access (progress is kept)." danger />}</Td></tr>
        ))}
      </Table>
      <Pagination page={page} pages={Math.max(1, Math.ceil(total / SIZE))} hrefFor={(p) => hrefWith("/admin/enrollments", sp, { page: String(p) })} label="Enrollments pagination" />
    </>
  );
}
