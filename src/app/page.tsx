import Link from "next/link";
import { ShieldCheck, Stethoscope, Award, Languages } from "lucide-react";
import { db } from "@/lib/db";
import { getT, pick, type MessageKey } from "@/i18n";
import { getCurrentUser } from "@/lib/auth";
import { listCourses, progressFor } from "@/lib/catalog";
import { CourseCard } from "@/components/CourseCard";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { t, locale } = await getT();
  const user = await getCurrentUser();
  const [featured, categories, courseCount, lessonCount, questionCount] = await Promise.all([
    listCourses({ sort: "popular" }),
    db.courseCategory.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { courses: { where: { status: "PUBLISHED" } } } } } }),
    db.course.count({ where: { status: "PUBLISHED", deletedAt: null } }),
    db.lesson.count({ where: { status: "PUBLISHED", deletedAt: null } }),
    db.quizQuestion.count({ where: { quiz: { status: "PUBLISHED" } } }),
  ]);
  const items = featured.items.slice(0, 3);
  const prog = await progressFor(user?.id, items.map((c) => c.id));
  const why = [
    [Stethoscope, "home.why1"], [ShieldCheck, "home.why2"], [Award, "home.why3"], [Languages, "home.why4"],
  ] as const;
  const faqs = [1, 2, 3].map((n) => [t(`faq.q${n}` as MessageKey), t(`faq.a${n}` as MessageKey)]);

  return (
    <>
      <section className="border-b border-border bg-surface">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-secondary">{t("home.eyebrow")}</p>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight text-primary-dark sm:text-5xl">{t("home.title")}</h1>
            <p className="mt-5 max-w-xl text-lg text-muted">{t("home.lead")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/courses" className="btn-primary">{t("home.cta1")}</Link>
              {!user && <Link href="/register" className="btn-secondary">{t("home.cta2")}</Link>}
            </div>
          </div>
          <div className="relative hidden lg:block" aria-hidden>
            <div className="rounded-lg bg-primary-dark p-10 text-white shadow-card">
              <div className="grid grid-cols-3 gap-6 text-center">
                {[[courseCount, t("home.stat.courses")], [lessonCount, t("home.stat.lessons")], [questionCount, t("home.stat.questions")]].map(([n, l]) => (
                  <div key={String(l)}><div className="text-4xl font-semibold">{n}</div><div className="mt-1 text-xs text-white/75">{l}</div></div>
                ))}
              </div>
              <div className="mt-8 border-t border-white/20 pt-6 text-sm text-white/80">{t("brand.subtitle")}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex items-end justify-between"><h2 className="text-2xl font-semibold text-primary-dark">{t("home.featured")}</h2><Link href="/courses" className="text-sm font-semibold text-primary">{t("nav.courses")} →</Link></div>
        {items.length ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{items.map((c) => <CourseCard key={c.id} c={c} locale={locale} t={t} progress={prog.get(c.id)} />)}</div>
        ) : <EmptyState title={t("courses.empty")} />}
      </section>

      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <h2 className="mb-8 text-2xl font-semibold text-primary-dark">{t("home.categories")}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((c) => (
              <Link key={c.id} href={`/courses?category=${c.slug}`} className="card p-5 transition-colors hover:border-primary">
                <div className="font-semibold">{pick(locale, c.nameEn, c.nameAr)}</div>
                <div className="mt-1 text-sm text-muted">{c._count.courses} {t("nav.courses")}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="mb-8 text-2xl font-semibold text-primary-dark">{t("home.why")}</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {why.map(([Icon, k]) => (
            <div key={k} className="card p-6">
              <Icon className="text-primary" size={26} aria-hidden />
              <h3 className="mt-4 font-semibold">{t(`${k}.t` as MessageKey)}</h3>
              <p className="mt-2 text-sm text-muted">{t(`${k}.d` as MessageKey)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-surface">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-2">
          <div><h2 className="text-xl font-semibold text-primary-dark">{t("home.paths")}</h2><p className="mt-2 text-muted">{t("home.paths.d")}</p></div>
          <div><h2 className="text-xl font-semibold text-primary-dark">{t("home.testimonials")}</h2><p className="mt-2 text-muted">{t("home.testimonials.d")}</p></div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h2 className="mb-6 text-2xl font-semibold text-primary-dark">{t("home.faq")}</h2>
        <div className="divide-y divide-border rounded-lg border border-border bg-surface">
          {faqs.map(([q, a]) => (
            <details key={q} className="group p-5"><summary className="cursor-pointer font-medium">{q}</summary><p className="mt-2 text-sm text-muted">{a}</p></details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="rounded-lg bg-primary-dark px-8 py-14 text-center text-white">
          <h2 className="text-3xl font-semibold">{t("home.final.t")}</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/80">{t("home.final.d")}</p>
          <Link href={user ? "/courses" : "/register"} className="btn mt-7 bg-white text-primary-dark hover:bg-primary-light">{user ? t("home.cta1") : t("home.cta2")}</Link>
        </div>
      </section>
    </>
  );
}
