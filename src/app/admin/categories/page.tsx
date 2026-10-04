import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/i18n";
import { AdminTitle } from "@/components/admin";
import { ActionForm } from "@/components/ui/ActionForm";
import { saveCategoryAction } from "@/app/actions/admin";

export const dynamic = "force-dynamic";

export default async function Categories() {
  await requirePermission("courses.write");
  const { t } = await getT();
  const cats = await db.courseCategory.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { courses: true } } } });
  const fields = (c?: (typeof cats)[number]) => (
    <div className="grid gap-3 sm:grid-cols-3">
      {c && <input type="hidden" name="id" value={c.id} />}
      <div><label className="label" htmlFor={`en${c?.id ?? "new"}`}>Name (EN)</label><input id={`en${c?.id ?? "new"}`} name="nameEn" defaultValue={c?.nameEn} required className="input" /></div>
      <div><label className="label" htmlFor={`ar${c?.id ?? "new"}`}>Name (AR)</label><input id={`ar${c?.id ?? "new"}`} name="nameAr" dir="rtl" defaultValue={c?.nameAr} required className="input" /></div>
      <div><label className="label" htmlFor={`so${c?.id ?? "new"}`}>Order</label><input id={`so${c?.id ?? "new"}`} name="sortOrder" type="number" defaultValue={c?.sortOrder ?? 0} className="input" /></div>
    </div>
  );
  return (
    <>
      <AdminTitle title={t("admin.categories")} />
      <div className="space-y-4">
        {cats.map((c) => <section key={c.id} className="card p-4"><p className="mb-2 text-xs text-muted">{c.slug} · {c._count.courses} courses</p><ActionForm action={saveCategoryAction} submitLabel="Save" buttonClass="btn-secondary" className="space-y-3">{fields(c)}</ActionForm></section>)}
        <section className="card border-dashed p-4"><h2 className="mb-2 font-semibold">New category</h2><ActionForm action={saveCategoryAction} submitLabel="Create" buttonClass="btn-primary" className="space-y-3">{fields()}</ActionForm></section>
      </div>
    </>
  );
}
