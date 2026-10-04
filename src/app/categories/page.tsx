import Link from "next/link";
import { db } from "@/lib/db";
import { getT, pick } from "@/i18n";
import { PageHeader } from "@/components/ui";
export const metadata = { title: "Categories" };
export const dynamic = "force-dynamic";
export default async function Categories() {
  const { t, locale } = await getT();
  const cats = await db.courseCategory.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { courses: { where: { status: "PUBLISHED" } } } } } });
  return (<><PageHeader title={t("categories.title")} lead={t("categories.lead")} /><div className="mx-auto grid max-w-7xl gap-5 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
    {cats.map((c) => <Link key={c.id} href={`/courses?category=${c.slug}`} className="card p-6 transition-colors hover:border-primary"><h2 className="text-lg font-semibold">{pick(locale, c.nameEn, c.nameAr)}</h2><p className="mt-1 text-sm text-muted">{c._count.courses} {t("nav.courses")}</p></Link>)}
  </div></>);
}
