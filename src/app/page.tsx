import Link from "next/link";
import { ArrowRight, Award, BookOpenCheck, Languages, ShieldCheck, Stethoscope } from "lucide-react";
import { db } from "@/lib/db";
import { getT, pick, type MessageKey } from "@/i18n";
import { getCurrentUser } from "@/lib/auth";
import { listCourses, progressFor } from "@/lib/catalog";
import { CourseCard } from "@/components/CourseCard";
import { categoryIcon } from "@/components/icons";
import { EmptyState, SectionHead } from "@/components/ui";
import { Reveal } from "@/components/Reveal";
import { themeVars } from "@/lib/category-theme";
import { getBrand } from "@/lib/brand";

export const dynamic = "force-dynamic";

/** Decorative lotus petals for the hero (pure SVG, brand-tinted). */
function Petals() {
  return (
    <svg viewBox="0 0 400 400" className="h-full w-full" aria-hidden>
      <g fill="none" stroke="white" strokeOpacity=".18" strokeWidth="1.5"><circle cx="200" cy="210" r="150" /><circle cx="200" cy="210" r="110" /><circle cx="200" cy="210" r="70" /></g>
      <g fill="white">
        <path d="M200 60c38 34 52 88 0 160-52-72-38-126 0-160z" fillOpacity=".95" />
        <path d="M200 220C150 212 105 170 92 110c46 2 92 34 108 110z" fillOpacity=".55" />
        <path d="M200 220c50-8 95-50 108-110-46 2-92 34-108 110z" fillOpacity=".55" />
        <path d="M200 232c-58 18-112-4-150-48 12 62 62 112 150 112s138-50 150-112c-38 44-92 66-150 48z" fillOpacity=".3" />
      </g>
    </svg>
  );
}

export default async function Home() {
  const { t, locale } = await getT();
  const user = await getCurrentUser();
  const brand = await getBrand();
  const [featured, categories, courseCount, lessonCount, questionCount] = await Promise.all([
    listCourses({ sort: "popular" }),
    db.courseCategory.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { courses: { where: { status: "PUBLISHED" } } } } } }),
    db.course.count({ where: { status: "PUBLISHED", deletedAt: null } }),
    db.lesson.count({ where: { status: "PUBLISHED", deletedAt: null } }),
    db.quizQuestion.count({ where: { quiz: { status: "PUBLISHED" } } }),
  ]);
  const items = featured.items.slice(0, 3);
  const prog = await progressFor(user?.id, items.map((c) => c.id));
  const why = [[Stethoscope, "home.why1"], [ShieldCheck, "home.why2"], [Award, "home.why3"], [Languages, "home.why4"]] as const;
  const faqs = [1, 2, 3].map((n) => [t(`faq.q${n}` as MessageKey), t(`faq.a${n}` as MessageKey)]);
  const stats = [[courseCount, t("home.stat.courses")], [lessonCount, t("home.stat.lessons")], [questionCount, t("home.stat.questions")]];

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-[#00894a] to-primary-dark bg-[length:200%_200%] text-white shadow-lift animate-gradient">
          {brand.logo ? (
            <div className="absolute end-10 top-[46%] hidden -translate-y-1/2 animate-float md:block lg:end-20" aria-hidden>
              <div className="flex h-52 w-52 items-center justify-center rounded-[2.25rem] bg-white p-7 shadow-lift ring-8 ring-white/20 lg:h-64 lg:w-64">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/brand/logo?v=${brand.logo}`} alt="" className="max-h-full max-w-full object-contain" />
              </div>
            </div>
          ) : (
            <div className="pointer-events-none absolute -end-20 -top-10 hidden h-[28rem] w-[28rem] animate-float opacity-90 md:block"><Petals /></div>
          )}
          <span className="pointer-events-none absolute -bottom-24 start-1/3 h-72 w-72 rounded-full bg-white/5 blur-2xl" aria-hidden />
          <div className="relative grid gap-10 px-6 py-14 sm:px-12 sm:py-20 lg:max-w-[62%]">
            <div>
              <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-bold uppercase tracking-widest">
                <BookOpenCheck size={14} aria-hidden /> {t("home.eyebrow")}
              </p>
              <h1 className="text-4xl font-extrabold leading-[1.15] tracking-tight sm:text-5xl">{t("home.title")}</h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-white/85">{t("home.lead")}</p>
              <form action="/courses" method="get" role="search" className="mt-8 max-w-xl">
                <label htmlFor="hero-q" className="sr-only">{t("courses.search")}</label>
                <div className="flex items-center gap-2 rounded-full bg-white p-1.5 ps-5 text-text shadow-lift ring-4 ring-white/25">
                  <input id="hero-q" name="q" maxLength={100} placeholder={t("search.placeholder")} className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted" />
                  <button type="submit" className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark">{t("common.search")}</button>
                </div>
              </form>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/courses" className="btn-white">{t("home.cta1")} <ArrowRight size={16} className="rtl:-scale-x-100" aria-hidden /></Link>
                {!user && <Link href="/register" className="btn-outline-white">{t("home.cta2")}</Link>}
              </div>
            </div>
          </div>
        </div>
        <dl className="relative z-10 -mt-8 grid grid-cols-3 gap-3 px-3 sm:mx-auto sm:max-w-3xl sm:gap-5 sm:px-0">
          {stats.map(([n, l]) => (
            <div key={String(l)} className="card flex flex-col p-4 text-center sm:p-5"><dt className="order-2 text-xs text-muted sm:text-sm">{l}</dt><dd className="text-2xl font-extrabold text-primary sm:text-3xl">{n}</dd></div>
          ))}
        </dl>
      </section>

      <Reveal><section className="mx-auto max-w-7xl px-4 pt-20 sm:px-6">
        <SectionHead eyebrow={t("nav.categories")} title={t("home.categories")} />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
          {categories.map((c) => {
            const Icon = categoryIcon(c.slug);
            return (
              <Link key={c.id} href={`/courses?category=${c.slug}`} style={themeVars(c.slug)} className="group flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-5 text-center transition-all duration-300 hover:-translate-y-1.5 hover:border-[var(--accent)] hover:shadow-lift">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--soft)] text-[var(--accent)] transition-all duration-300 group-hover:scale-110 group-hover:bg-[var(--accent)] group-hover:text-white"><Icon size={28} aria-hidden /></span>
                <span className="text-sm font-bold leading-tight">{pick(locale, c.nameEn, c.nameAr)}</span>
                <span className="text-xs text-muted">{c._count.courses} {t("nav.courses")}</span>
              </Link>
            );
          })}
        </div>
      </section></Reveal>

      <Reveal><section className="mx-auto max-w-7xl px-4 pt-20 sm:px-6">
        <SectionHead eyebrow={t("nav.courses")} title={t("home.featured")} action={<Link href="/courses" className="inline-flex items-center gap-1 text-sm font-bold text-primary underline-offset-4 hover:underline">{t("nav.courses")} <ArrowRight size={16} className="rtl:-scale-x-100" aria-hidden /></Link>} />
        {items.length ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{items.map((c, i) => <CourseCard key={c.id} c={c} locale={locale} t={t} progress={prog.get(c.id)} index={i} />)}</div>
        ) : <EmptyState title={t("courses.empty")} />}
      </section></Reveal>

      <Reveal><section className="mx-auto mt-20 max-w-7xl px-4 sm:px-6">
        <div className="rounded-3xl bg-primary-light px-6 py-14 sm:px-12">
          <h2 className="mb-10 text-center text-2xl font-extrabold text-primary-dark">{t("home.why")}</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {why.map(([Icon, k]) => (
              <div key={k} className="rounded-2xl bg-white p-6 shadow-card">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white"><Icon size={24} aria-hidden /></span>
                <h3 className="mt-4 font-bold">{t(`${k}.t` as MessageKey)}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{t(`${k}.d` as MessageKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section></Reveal>

      <Reveal><section className="mx-auto grid max-w-7xl gap-6 px-4 pt-20 sm:px-6 md:grid-cols-2">
        <div className="card p-8"><h2 className="text-xl font-extrabold text-primary-dark">{t("home.paths")}</h2><p className="mt-2 text-muted">{t("home.paths.d")}</p></div>
        <div className="card p-8"><h2 className="text-xl font-extrabold text-primary-dark">{t("home.testimonials")}</h2><p className="mt-2 text-muted">{t("home.testimonials.d")}</p></div>
      </section></Reveal>

      <Reveal><section className="mx-auto max-w-3xl px-4 pt-20 sm:px-6">
        <h2 className="mb-6 text-2xl font-extrabold text-primary-dark">{t("home.faq")}</h2>
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {faqs.map(([q, a]) => (
            <details key={q} className="group p-5"><summary className="cursor-pointer font-semibold marker:text-primary">{q}</summary><p className="mt-2 text-sm leading-6 text-muted">{a}</p></details>
          ))}
        </div>
      </section></Reveal>

      <Reveal><section className="mx-auto max-w-7xl px-4 pt-20 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary-dark px-8 py-16 text-center text-white">
          <div className="pointer-events-none absolute -start-16 -bottom-24 h-72 w-72 opacity-60"><Petals /></div>
          <h2 className="relative text-3xl font-extrabold">{t("home.final.t")}</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-white/85">{t("home.final.d")}</p>
          <Link href={user ? "/courses" : "/register"} className="btn-white relative mt-8">{user ? t("home.cta1") : t("home.cta2")}</Link>
        </div>
      </section></Reveal>
    </>
  );
}
