import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminTitle, Table, Td } from "@/components/admin";
import { ActionForm } from "@/components/ui/ActionForm";
import { Badge } from "@/components/ui";
import { createPathAction } from "@/app/actions/engagement";

export const dynamic = "force-dynamic";

export default async function AdminPaths() {
  await requirePermission("courses.read");
  const [paths, audiences] = await Promise.all([
    db.learningPath.findMany({ orderBy: { createdAt: "asc" }, include: { audience: true, _count: { select: { courses: true, enrollments: true } }, enrollments: { where: { completedAt: { not: null } }, select: { id: true } } } }),
    db.audience.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  return (
    <>
      <AdminTitle title="Learning paths" />
      <p className="mb-6 max-w-3xl text-sm text-muted">A learning path is a set of courses taken in order (each unlocks when the previous one is completed) — for example the onboarding programme for new pharmacists or new branch managers. Paths flagged <em>auto-assign</em> are given automatically to new staff of the job role (registered, imported or activated after the path was created).</p>
      <Table caption="Learning paths" head={["Path", "Job role", "Courses", "Learners", "Completed", "Auto-assign", "Status"]}>
        {paths.map((p) => (
          <tr key={p.id}>
            <Td><Link className="font-semibold text-primary hover:underline" href={`/admin/paths/${p.id}`}>{p.titleEn}</Link>{p.titleAr && <div className="text-xs text-muted" dir="rtl">{p.titleAr}</div>}</Td>
            <Td>{p.audience?.nameEn ?? "Everyone"}</Td>
            <Td>{p._count.courses}</Td>
            <Td>{p._count.enrollments}</Td>
            <Td>{p.enrollments.length}</Td>
            <Td>{p.autoAssignNewHires ? <Badge tone="primary">New hires{p.dueDays ? ` · ${p.dueDays} days` : ""}</Badge> : "—"}</Td>
            <Td>{p.published ? <Badge tone="success">Published</Badge> : <Badge>Draft</Badge>}</Td>
          </tr>
        ))}
        {!paths.length && <tr><Td className="text-muted">No paths yet.</Td></tr>}
      </Table>
      <section className="card mt-6 max-w-2xl p-5">
        <h2 className="mb-3 font-semibold">New learning path</h2>
        <ActionForm action={createPathAction} submitLabel="Create path" buttonClass="btn-primary">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label" htmlFor="titleEn">Title (EN)</label><input id="titleEn" name="titleEn" required className="input" placeholder="New Pharmacist Onboarding" /></div>
            <div><label className="label" htmlFor="titleAr">Title (AR)</label><input id="titleAr" name="titleAr" dir="rtl" className="input" placeholder="برنامج تأهيل الصيادلة الجدد" /></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="audienceId">Job role</label><select id="audienceId" name="audienceId" className="input"><option value="">Everyone</option>{audiences.map((a) => <option key={a.id} value={a.id}>{a.nameEn}</option>)}</select></div>
          </div>
        </ActionForm>
      </section>
    </>
  );
}
