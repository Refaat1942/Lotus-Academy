import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/i18n";
import { AdminTitle } from "@/components/admin";
import { ActionForm } from "@/components/ui/ActionForm";
import { broadcastAction } from "@/app/actions/admin";

export const dynamic = "force-dynamic";

export default async function Notifications() {
  await requirePermission("settings.write");
  const { t } = await getT();
  const courses = await db.course.findMany({ where: { status: "PUBLISHED" }, select: { id: true, titleEn: true }, orderBy: { sortOrder: "asc" } });
  return (
    <>
      <AdminTitle title={t("admin.notifications")} />
      <section className="card max-w-2xl p-5"><h2 className="mb-1 font-semibold">Send announcement</h2><p className="mb-4 text-sm text-muted">Creates an in-app notification. When a course is selected, enrolled learners also get a “course updated” email.</p>
        <ActionForm action={broadcastAction} submitLabel="Send" buttonClass="btn-primary">
          <div><label className="label" htmlFor="courseId">Audience</label><select id="courseId" name="courseId" className="input"><option value="">All students</option>{courses.map((c) => <option key={c.id} value={c.id}>Enrolled in: {c.titleEn}</option>)}</select></div>
          <div><label className="label" htmlFor="title">Title</label><input id="title" name="title" required maxLength={200} className="input" /></div>
          <div><label className="label" htmlFor="body">Message</label><textarea id="body" name="body" rows={3} maxLength={1000} className="input" /></div>
        </ActionForm></section>
    </>
  );
}
