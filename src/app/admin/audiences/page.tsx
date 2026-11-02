import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminTitle } from "@/components/admin";
import { ActionForm } from "@/components/ui/ActionForm";
import { saveAudienceAction } from "@/app/actions/admin";

export const dynamic = "force-dynamic";

export default async function Audiences() {
  await requirePermission("settings.write");
  const list = await db.audience.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { users: true, courses: true } } } });
  const fields = (a?: (typeof list)[number]) => (
    <div className="grid gap-3 sm:grid-cols-3">
      {a && <input type="hidden" name="id" value={a.id} />}
      <div><label className="label" htmlFor={`en${a?.id ?? "n"}`}>Name (EN)</label><input id={`en${a?.id ?? "n"}`} name="nameEn" defaultValue={a?.nameEn} required className="input" /></div>
      <div><label className="label" htmlFor={`ar${a?.id ?? "n"}`}>Name (AR)</label><input id={`ar${a?.id ?? "n"}`} name="nameAr" dir="rtl" defaultValue={a?.nameAr} required className="input" /></div>
      <div><label className="label" htmlFor={`so${a?.id ?? "n"}`}>Order</label><input id={`so${a?.id ?? "n"}`} name="sortOrder" type="number" defaultValue={a?.sortOrder ?? list.length + 1} className="input" /></div>
    </div>
  );
  return (
    <>
      <AdminTitle title="Job roles & learning tracks" />
      <p className="mb-6 max-w-3xl text-sm text-muted">Each learner belongs to one job role. Courses can target roles, be mandatory for them with a due date, or be hidden from other roles (set this on each course). Track completion in <Link className="text-primary underline" href="/admin/compliance">Compliance</Link>.</p>
      <div className="space-y-4">
        {list.map((a) => (
          <section key={a.id} className="card p-4">
            <p className="mb-2 text-xs text-muted"><span className="font-mono">{a.key}</span> · <Link className="text-primary underline" href={`/admin/users?audience=${a.id}`}>{a._count.users} users</Link> · {a._count.courses} courses</p>
            <ActionForm action={saveAudienceAction} submitLabel="Save" buttonClass="btn-secondary" className="space-y-3">{fields(a)}</ActionForm>
          </section>
        ))}
        <section className="card border-dashed p-4"><h2 className="mb-2 font-semibold">Add a job role</h2><ActionForm action={saveAudienceAction} submitLabel="Create" buttonClass="btn-primary" className="space-y-3">{fields()}</ActionForm></section>
      </div>
    </>
  );
}
