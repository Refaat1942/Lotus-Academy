import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/i18n";
import { AdminTitle, Table, Td } from "@/components/admin";
import { Badge } from "@/components/ui";
import { ConfirmAction } from "@/components/ConfirmAction";
import { createCourseAction, setCourseStatusAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/ui/ActionForm";

export const dynamic = "force-dynamic";

export default async function AdminCourses() {
  const me = await requirePermission("courses.read");
  const { t } = await getT();
  const courses = await db.course.findMany({ where: { deletedAt: null }, orderBy: { sortOrder: "asc" }, include: { category: true, _count: { select: { lessons: { where: { deletedAt: null } }, enrollments: true } } } });
  const tone = { PUBLISHED: "success", DRAFT: "warning", ARCHIVED: "neutral" } as const;
  return (
    <>
      <AdminTitle title={t("admin.courses")} actions={<a className="btn-secondary" href="/api/admin/export/courses">{t("common.export")}</a>} />
      <Table caption={t("admin.courses")} head={["Code", "Title", "Category", t("admin.lessons"), "Enrolled", t("common.status"), t("common.actions")]}>
        {courses.map((c) => (
          <tr key={c.id}>
            <Td className="font-mono text-xs">{c.code}</Td>
            <Td><Link className="font-medium text-primary" href={`/admin/courses/${c.id}`}>{c.titleEn}</Link></Td>
            <Td className="text-muted">{c.category?.nameEn}</Td><Td>{c._count.lessons}</Td><Td>{c._count.enrollments}</Td>
            <Td><Badge tone={tone[c.status]}>{c.status}</Badge></Td>
            <Td><div className="flex gap-2">
              {me.permissions.has("courses.publish") && (c.status === "PUBLISHED"
                ? <ConfirmAction action={setCourseStatusAction} fields={{ id: c.id, status: "DRAFT" }} label="Unpublish" message="Unpublish this course? It disappears from the catalog; enrolled learners lose access until republished." />
                : <ConfirmAction action={setCourseStatusAction} fields={{ id: c.id, status: "PUBLISHED" }} label="Publish" message="Publish this course to the public catalog?" />)}
              {me.permissions.has("courses.publish") && c.status !== "ARCHIVED" && <ConfirmAction action={setCourseStatusAction} fields={{ id: c.id, status: "ARCHIVED" }} label="Archive" message="Archive this course?" danger />}
            </div></Td>
          </tr>
        ))}
      </Table>
      {me.permissions.has("courses.write") && (
        <section className="card mt-8 max-w-xl p-5"><h2 className="mb-3 font-semibold">New course</h2>
          <ActionForm action={createCourseAction} submitLabel="Create draft" buttonClass="btn-primary"><div><label className="label" htmlFor="titleEn">Title (English)</label><input id="titleEn" name="titleEn" required minLength={2} maxLength={200} className="input" /></div></ActionForm></section>
      )}
    </>
  );
}
