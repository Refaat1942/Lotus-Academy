import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminTitle, Table, Td } from "@/components/admin";
import { ActionForm } from "@/components/ui/ActionForm";
import { Progress } from "@/components/ui";
import { ConfirmAction } from "@/components/ConfirmAction";
import { assignPathRoleAction, deletePathAction, pathCourseAction, updatePathAction } from "@/app/actions/engagement";
import { myPaths } from "@/lib/paths";

export const dynamic = "force-dynamic";

export default async function AdminPath({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePermission("courses.read");
  const path = await db.learningPath.findUnique({
    where: { id },
    include: { courses: { orderBy: { position: "asc" }, include: { course: { select: { id: true, titleEn: true, code: true, status: true } } } }, enrollments: { include: { user: { select: { id: true, firstName: true, lastName: true, branch: true } } }, orderBy: { startedAt: "desc" }, take: 200 } },
  });
  if (!path) notFound();
  const [audiences, courses] = await Promise.all([
    db.audience.findMany({ orderBy: { sortOrder: "asc" } }),
    db.course.findMany({ where: { deletedAt: null, id: { notIn: path.courses.map((c) => c.courseId) } }, orderBy: { sortOrder: "asc" }, select: { id: true, titleEn: true, code: true } }),
  ]);
  const progress = new Map((await Promise.all(path.enrollments.map(async (e) => [e.userId, (await myPaths(e.userId)).find((p) => p.path.id === id)?.percent ?? 0] as const))));

  return (
    <>
      <AdminTitle title={path.titleEn} actions={<Link href="/admin/paths" className="btn-secondary">← All paths</Link>} />
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Details</h2>
          <ActionForm action={updatePathAction} submitLabel="Save" buttonClass="btn-primary">
            <input type="hidden" name="id" value={path.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="label" htmlFor="titleEn">Title (EN)</label><input id="titleEn" name="titleEn" defaultValue={path.titleEn} required className="input" /></div>
              <div><label className="label" htmlFor="titleAr">Title (AR)</label><input id="titleAr" name="titleAr" dir="rtl" defaultValue={path.titleAr ?? ""} className="input" /></div>
              <div><label className="label" htmlFor="descriptionEn">Description (EN)</label><textarea id="descriptionEn" name="descriptionEn" rows={3} defaultValue={path.descriptionEn ?? ""} className="input" /></div>
              <div><label className="label" htmlFor="descriptionAr">Description (AR)</label><textarea id="descriptionAr" name="descriptionAr" dir="rtl" rows={3} defaultValue={path.descriptionAr ?? ""} className="input" /></div>
              <div><label className="label" htmlFor="audienceId">Job role</label><select id="audienceId" name="audienceId" defaultValue={path.audienceId ?? ""} className="input"><option value="">Everyone</option>{audiences.map((a) => <option key={a.id} value={a.id}>{a.nameEn}</option>)}</select></div>
              <div><label className="label" htmlFor="dueDays">Days to complete (from assignment)</label><input id="dueDays" name="dueDays" type="number" min={0} defaultValue={path.dueDays ?? ""} placeholder="No deadline" className="input" /></div>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="autoAssignNewHires" defaultChecked={path.autoAssignNewHires} /> Auto-assign to new staff of this job role</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" defaultChecked={path.published} /> Published (visible to learners)</label>
          </ActionForm>
        </section>

        <section className="card p-5">
          <h2 className="mb-1 font-semibold">Courses in order</h2>
          <p className="mb-3 text-sm text-muted">Learners take these one after another. Every course is added to their training as mandatory, with the path&apos;s due date.</p>
          <ol className="space-y-2">
            {path.courses.map((c, i) => (
              <li key={c.courseId} className="flex items-center gap-2 rounded-xl border border-border p-2 text-sm">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{c.course.titleEn} <span className="text-xs text-muted">{c.course.code}{c.course.status !== "PUBLISHED" ? " · not published" : ""}</span></span>
                {(["up", "down", "remove"] as const).map((op) => (
                  <form key={op} action={pathCourseAction}><input type="hidden" name="pathId" value={path.id} /><input type="hidden" name="courseId" value={c.courseId} /><input type="hidden" name="op" value={op} />
                    <button type="submit" className="btn-secondary !p-1.5" aria-label={`${op} ${c.course.titleEn}`} disabled={(op === "up" && i === 0) || (op === "down" && i === path.courses.length - 1)}>{op === "up" ? <ArrowUp size={14} aria-hidden /> : op === "down" ? <ArrowDown size={14} aria-hidden /> : <Trash2 size={14} aria-hidden />}</button></form>
                ))}
              </li>
            ))}
          </ol>
          <form action={pathCourseAction} className="mt-3 flex gap-2"><input type="hidden" name="pathId" value={path.id} /><input type="hidden" name="op" value="add" />
            <select name="courseId" required className="input" aria-label="Course to add"><option value="">Add a course…</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.code ? `${c.code} — ` : ""}{c.titleEn}</option>)}</select>
            <button className="btn-primary" type="submit">Add</button></form>
        </section>
      </div>

      <section className="card mt-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold">Learners ({path.enrollments.length})</h2><p className="text-sm text-muted">Existing staff are not added automatically — use the button to give this path to everyone currently in the job role.</p></div>
          <ActionForm action={assignPathRoleAction} submitLabel={`Assign to all current ${audiences.find((a) => a.id === path.audienceId)?.nameEn ?? "staff"}`} buttonClass="btn-secondary" className="flex flex-wrap items-center gap-2"><input type="hidden" name="pathId" value={path.id} /></ActionForm>
        </div>
        {path.enrollments.length > 0 && (
          <div className="mt-4"><Table caption="Path learners" head={["Learner", "Branch", "Started", "Due", "Progress", "Completed"]}>
            {path.enrollments.map((e) => (
              <tr key={e.id}>
                <Td><Link className="text-primary hover:underline" href={`/admin/users/${e.userId}`}>{e.user.firstName} {e.user.lastName}</Link></Td>
                <Td>{e.user.branch ?? "—"}</Td>
                <Td>{e.startedAt.toLocaleDateString("en-GB")}</Td>
                <Td className={e.dueAt && !e.completedAt && e.dueAt < new Date() ? "font-semibold text-error" : ""}>{e.dueAt?.toLocaleDateString("en-GB") ?? "—"}</Td>
                <Td><div className="flex min-w-[120px] items-center gap-2"><Progress value={progress.get(e.userId) ?? 0} /><span className="text-xs">{progress.get(e.userId) ?? 0}%</span></div></Td>
                <Td>{e.completedAt?.toLocaleDateString("en-GB") ?? "—"}</Td>
              </tr>))}
          </Table></div>
        )}
      </section>

      <section className="mt-6"><ConfirmAction action={deletePathAction} fields={{ id: path.id }} label="Delete path" danger message="Delete this path? Learners keep their course enrolments and progress." /></section>
    </>
  );
}
