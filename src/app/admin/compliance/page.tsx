import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { complianceRows } from "@/lib/reports";
import { AdminTitle, Table, Td, hrefWith } from "@/components/admin";
import { Badge, StatCard } from "@/components/ui";

export const dynamic = "force-dynamic";
const tone = { COMPLETED: "success", IN_PROGRESS: "primary", NOT_STARTED: "neutral", OVERDUE: "error" } as const;

export default async function Compliance({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermission("reports.read");
  const sp = await searchParams;
  const f = { audienceId: sp.audience, courseId: sp.course, branch: sp.branch, area: sp.area, status: sp.status, mandatoryOnly: sp.all !== "1" };
  const [rows, audiences, courses] = await Promise.all([
    complianceRows(f),
    db.audience.findMany({ orderBy: { sortOrder: "asc" } }),
    db.course.findMany({ where: { deletedAt: null }, orderBy: { sortOrder: "asc" }, select: { id: true, titleEn: true } }),
  ]);
  const count = (s: string) => rows.filter((r) => r.compliance === s).length;
  const perCourse = new Map<string, { title: string; total: number; done: number; overdue: number }>();
  for (const r of rows) {
    const c = perCourse.get(r.courseId) ?? { title: r.course.titleEn, total: 0, done: 0, overdue: 0 };
    c.total++; if (r.compliance === "COMPLETED") c.done++; if (r.compliance === "OVERDUE") c.overdue++;
    perCourse.set(r.courseId, c);
  }
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();
  const shown = rows.slice(0, 500);
  return (
    <>
      <AdminTitle title="Training compliance" actions={<a className="btn-secondary" href={`/api/admin/export/compliance?${qs}`}>Export CSV</a>} />
      <form method="get" className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <div><label className="label" htmlFor="audience">Job role</label><select id="audience" name="audience" defaultValue={sp.audience ?? ""} className="input"><option value="">All</option>{audiences.map((a) => <option key={a.id} value={a.id}>{a.nameEn}</option>)}</select></div>
        <div><label className="label" htmlFor="course">Course</label><select id="course" name="course" defaultValue={sp.course ?? ""} className="input max-w-xs"><option value="">All</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.titleEn}</option>)}</select></div>
        <div><label className="label" htmlFor="branch">Branch</label><input id="branch" name="branch" defaultValue={sp.branch} className="input max-w-[10rem]" /></div>
        <div><label className="label" htmlFor="area">Area</label><input id="area" name="area" defaultValue={sp.area} className="input max-w-[10rem]" /></div>
        <div><label className="label" htmlFor="status">Status</label><select id="status" name="status" defaultValue={sp.status ?? ""} className="input"><option value="">All</option><option value="OVERDUE">Overdue</option><option value="NOT_STARTED">Not started</option><option value="IN_PROGRESS">In progress</option><option value="COMPLETED">Completed</option></select></div>
        <label className="flex items-center gap-2 pb-3 text-sm"><input type="checkbox" name="all" value="1" defaultChecked={sp.all === "1"} /> Include self-enrolled</label>
        <button className="btn-primary" type="submit">Apply</button>
      </form>
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Assignments" value={rows.length} />
        <StatCard label="Completed" value={count("COMPLETED")} hint={rows.length ? `${Math.round((count("COMPLETED") / rows.length) * 100)}%` : undefined} />
        <StatCard label="In progress" value={count("IN_PROGRESS")} />
        <StatCard label="Not started" value={count("NOT_STARTED")} />
        <StatCard label="Overdue" value={count("OVERDUE")} />
      </section>
      <section className="mt-8"><h2 className="mb-3 font-semibold">By course</h2>
        <Table caption="By course" head={["Course", "Assigned", "Completed", "Completion", "Overdue"]}>
          {[...perCourse.entries()].map(([id, c]) => <tr key={id}><Td><Link className="text-primary" href={hrefWith("/admin/compliance", sp, { course: id })}>{c.title}</Link></Td><Td>{c.total}</Td><Td>{c.done}</Td><Td>{Math.round((c.done / c.total) * 100)}%</Td><Td>{c.overdue ? <Badge tone="error">{c.overdue}</Badge> : "0"}</Td></tr>)}
        </Table></section>
      <section className="mt-8"><h2 className="mb-3 font-semibold">Learners {rows.length > shown.length ? `(first ${shown.length} of ${rows.length} — export for all)` : ""}</h2>
        <Table caption="Learners" head={["Learner", "Job role", "Branch / Area", "Course", "Progress", "Due", "Status"]}>
          {shown.map((r) => <tr key={r.id}><Td><Link className="text-primary" href={`/admin/users/${r.userId}`}>{r.user.firstName} {r.user.lastName}</Link></Td><Td>{r.user.audience?.nameEn ?? "—"}</Td><Td className="text-xs text-muted">{[r.user.branch, r.user.area].filter(Boolean).join(" · ") || "—"}</Td><Td>{r.course.titleEn}</Td><Td>{r.percent}%</Td><Td className="text-muted">{r.dueAt?.toLocaleDateString() ?? "—"}</Td><Td><Badge tone={tone[r.compliance]}>{r.compliance.replace("_", " ")}</Badge></Td></tr>)}
        </Table></section>
    </>
  );
}
