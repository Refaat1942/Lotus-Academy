import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getT, pick } from "@/i18n";
import { getCurrentUser } from "@/lib/auth";
import { listCourses, progressFor } from "@/lib/catalog";
import { CourseCard } from "@/components/CourseCard";
import { EmptyState, PageHeader, Pagination } from "@/components/ui";

export const metadata: Metadata = { title: "Courses" };
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | undefined>>;

export default async function CoursesPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { t, locale } = await getT();
  const user = await getCurrentUser();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const [res, categories] = await Promise.all([
    listCourses({ q: sp.q, category: sp.category, level: sp.level, duration: sp.duration, sort: sp.sort, page }),
    db.courseCategory.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  const prog = await progressFor(user?.id, res.items.map((c) => c.id));
  const hrefFor = (p: number) => {
    const u = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    u.set("page", String(p));
    return `/courses?${u}`;
  };
  const hasFilters = !!(sp.q || sp.category || sp.level || sp.duration);
  return (
    <>
      <PageHeader title={t("courses.title")} lead={t("courses.lead")} />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <form method="get" role="search" className="card mb-8 grid gap-4 p-4 md:grid-cols-5">
          <div className="md:col-span-2"><label className="label" htmlFor="q">{t("courses.search")}</label><input id="q" name="q" defaultValue={sp.q} className="input" maxLength={100} /></div>
          <div><label className="label" htmlFor="category">{t("courses.category")}</label>
            <select id="category" name="category" defaultValue={sp.category ?? ""} className="input"><option value="">{t("common.all")}</option>{categories.map((c) => <option key={c.id} value={c.slug}>{pick(locale, c.nameEn, c.nameAr)}</option>)}</select></div>
          <div><label className="label" htmlFor="duration">{t("courses.duration")}</label>
            <select id="duration" name="duration" defaultValue={sp.duration ?? ""} className="input"><option value="">{t("courses.any")}</option><option value="short">≤ 6 {t("common.hours")}</option><option value="medium">6–10 {t("common.hours")}</option><option value="long">&gt; 10 {t("common.hours")}</option></select></div>
          <div><label className="label" htmlFor="sort">{t("courses.sort")}</label>
            <select id="sort" name="sort" defaultValue={sp.sort ?? ""} className="input"><option value="">{t("courses.sort.newest")}</option><option value="popular">{t("courses.sort.popular")}</option><option value="title">{t("courses.sort.title")}</option><option value="duration">{t("courses.sort.duration")}</option></select></div>
          <div className="flex items-end gap-3 md:col-span-5">
            <button className="btn-primary" type="submit">{t("common.search")}</button>
            {hasFilters && <Link href="/courses" className="btn-secondary">{t("courses.clear")}</Link>}
            <span className="ms-auto text-sm text-muted" aria-live="polite">{res.total} {t("nav.courses")}</span>
          </div>
        </form>
        {res.items.length ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{res.items.map((c) => <CourseCard key={c.id} c={c} locale={locale} t={t} progress={prog.get(c.id)} />)}</div>
        ) : <EmptyState title={t("courses.empty")} action={{ href: "/courses", label: t("courses.clear") }} />}
        <Pagination page={res.page} pages={res.pages} hrefFor={hrefFor} label="Courses pagination" />
      </div>
    </>
  );
}
