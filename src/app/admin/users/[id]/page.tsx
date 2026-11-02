import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminTitle, Table, Td } from "@/components/admin";
import { ActionForm } from "@/components/ui/ActionForm";
import { Badge } from "@/components/ui";
import { updateUserProfileAction } from "@/app/actions/admin";
import { complianceStatus } from "@/lib/audience";

export const dynamic = "force-dynamic";

export default async function EditUser({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePermission("users.read");
  const { id } = await params;
  const u = await db.user.findFirst({ where: { id, deletedAt: null }, include: { roles: { include: { role: true } }, enrollments: { include: { course: true }, orderBy: { enrolledAt: "desc" } }, courseProgress: true } });
  if (!u) notFound();
  const audiences = await db.audience.findMany({ orderBy: { sortOrder: "asc" } });
  const pm = new Map(u.courseProgress.map((p) => [p.courseId, p.percent]));
  const can = me.permissions.has("users.write");
  const tone = { COMPLETED: "success", IN_PROGRESS: "primary", NOT_STARTED: "neutral", OVERDUE: "error" } as const;
  return (
    <>
      <AdminTitle title={`${u.firstName} ${u.lastName}`} actions={<Link className="btn-secondary" href="/admin/users">← Users</Link>} />
      <div className="grid gap-8 xl:grid-cols-3">
        <section className="card p-5">
          <p className="mb-4 text-sm text-muted">{u.email} · {u.status} · {u.roles.map((r) => r.role.key).join(", ")}</p>
          {can ? (
            <ActionForm action={updateUserProfileAction} submitLabel="Save" buttonClass="btn-primary">
              <input type="hidden" name="id" value={u.id} />
              <div className="grid grid-cols-2 gap-3"><div><label className="label" htmlFor="firstName">First name</label><input id="firstName" name="firstName" defaultValue={u.firstName} required className="input" /></div>
                <div><label className="label" htmlFor="lastName">Last name</label><input id="lastName" name="lastName" defaultValue={u.lastName} required className="input" /></div></div>
              <div><label className="label" htmlFor="audienceId">Job role</label><select id="audienceId" name="audienceId" defaultValue={u.audienceId ?? ""} className="input"><option value="">— None —</option>{audiences.map((a) => <option key={a.id} value={a.id}>{a.nameEn} / {a.nameAr}</option>)}</select></div>
              <div><label className="label" htmlFor="branch">Branch</label><input id="branch" name="branch" defaultValue={u.branch ?? ""} className="input" /></div>
              <div><label className="label" htmlFor="area">Area</label><input id="area" name="area" defaultValue={u.area ?? ""} className="input" /></div>
              <div><label className="label" htmlFor="department">Department</label><input id="department" name="department" defaultValue={u.department ?? ""} className="input" /></div>
              <div><label className="label" htmlFor="phone">Phone</label><input id="phone" name="phone" defaultValue={u.phone ?? ""} className="input" /></div>
            </ActionForm>
          ) : <p className="text-sm">Read-only</p>}
        </section>
        <section className="xl:col-span-2"><h2 className="mb-3 font-semibold">Training</h2>
          <Table caption="Training" head={["Course", "Type", "Progress", "Due", "Status"]}>
            {u.enrollments.map((e) => { const st = complianceStatus(e, pm.get(e.courseId) ?? 0); return (
              <tr key={e.id}><Td>{e.course.titleEn}</Td><Td>{e.source === "assigned" ? <Badge tone="warning">Mandatory</Badge> : "Self"}</Td><Td>{pm.get(e.courseId) ?? 0}%</Td><Td className="text-muted">{e.dueAt?.toLocaleDateString() ?? "—"}</Td><Td><Badge tone={tone[st]}>{st.replace("_", " ")}</Badge></Td></tr>); })}
          </Table>
        </section>
      </div>
    </>
  );
}
