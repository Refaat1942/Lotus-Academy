import Link from "next/link";
import { db } from "@/lib/db";
import { getT, pick } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { resumeLesson } from "@/lib/domain";
import { listCourses } from "@/lib/catalog";
import { CourseCard } from "@/components/CourseCard";
import { EmptyState, Progress, StatCard } from "@/components/ui";

export const metadata = { title: "My learning" };
export const dynamic = "force-dynamic";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const sp = await searchParams;
  const { t, locale } = await getT();
  const user = await requireUser();
  const [enrollments, certs, notifications, attempts] = await Promise.all([
    db.enrollment.findMany({
      where: { userId: user.id, status: { not: "CANCELLED" } }, orderBy: { enrolledAt: "desc" },
      include: { course: { include: { lessons: { where: { status: "PUBLISHED", deletedAt: null }, orderBy: { position: "asc" }, select: { id: true, slug: true, durationMinutes: true } } } } },
    }),
    db.certificate.findMany({ where: { userId: user.id, revokedAt: null }, orderBy: { issuedAt: "desc" } }),
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.quizAttempt.findMany({ where: { userId: user.id, submittedAt: { not: null } }, orderBy: { startedAt: "desc" }, take: 5, include: { quiz: { select: { titleEn: true } } } }),
  ]);
  const [progress, done] = await Promise.all([
    db.courseProgress.findMany({ where: { userId: user.id } }),
    db.lessonProgress.findMany({ where: { userId: user.id, completedAt: { not: null } }, select: { lessonId: true, courseId: true } }),
  ]);
  const pm = new Map(progress.map((p) => [p.courseId, p.percent]));
  const doneSet = new Set(done.map((d) => d.lessonId));
  const completed = enrollments.filter((e) => e.status === "COMPLETED");
  const inProgress = enrollments.filter((e) => e.status === "ACTIVE");
  const avg = enrollments.length ? Math.round(enrollments.reduce((s, e) => s + (pm.get(e.courseId) ?? 0), 0) / enrollments.length) : 0;
  const minutes = enrollments.reduce((s, e) => s + e.course.lessons.filter((l) => doneSet.has(l.id)).reduce((a, l) => a + l.durationMinutes, 0), 0);
  const current = inProgress[0];
  const resumeId = current ? resumeLesson(current.course.lessons, doneSet, current.lastLessonId) : null;
  const resume = current?.course.lessons.find((l) => l.id === resumeId);
  const enrolledIds = new Set(enrollments.map((e) => e.courseId));
  const rec = (await listCourses({ sort: "popular" })).items.filter((c) => !enrolledIds.has(c.id)).slice(0, 3);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      {sp.denied && <p role="alert" className="mb-6 rounded border border-warning/40 bg-warning/10 px-4 py-3 text-sm">{t("dash.denied")}</p>}
      <h1 className="text-3xl font-semibold tracking-tight text-primary-dark">{t("dash.welcome")}, {user.firstName}</h1>

      {current && resume && (
        <section className="card mt-8 flex flex-wrap items-center justify-between gap-4 border-primary/30 bg-primary-light/40 p-6">
          <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wider text-secondary">{t("dash.continue")}</p>
            <h2 className="mt-1 text-xl font-semibold">{pick(locale, current.course.titleEn, current.course.titleAr)}</h2>
            <div className="mt-3 max-w-md"><Progress value={pm.get(current.courseId) ?? 0} /></div></div>
          <Link className="btn-primary" href={`/learn/${current.course.slug}/${resume.slug}`}>{t("courses.continue")}</Link>
        </section>
      )}

      <section aria-label="Statistics" className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label={t("dash.enrolled")} value={enrollments.length} />
        <StatCard label={t("dash.completed")} value={completed.length} />
        <StatCard label={t("dash.avg")} value={`${avg}%`} />
        <StatCard label={t("dash.hours")} value={(minutes / 60).toFixed(1)} />
        <StatCard label={t("dash.certs")} value={certs.length} />
      </section>

      <section className="mt-12"><h2 className="mb-4 text-xl font-semibold text-primary-dark">{t("dash.myCourses")}</h2>
        {enrollments.length ? (
          <div className="grid gap-4 md:grid-cols-2">{enrollments.map((e) => (
            <Link key={e.id} href={`/courses/${e.course.slug}`} className="card p-5 transition-colors hover:border-primary">
              <div className="flex justify-between gap-3"><h3 className="font-semibold">{pick(locale, e.course.titleEn, e.course.titleAr)}</h3><span className="text-sm text-muted">{pm.get(e.courseId) ?? 0}%</span></div>
              <div className="mt-3"><Progress value={pm.get(e.courseId) ?? 0} /></div>
            </Link>))}</div>
        ) : <EmptyState title={t("dash.noCourses")} action={{ href: "/courses", label: t("dash.browse") }} />}
      </section>

      <div className="mt-12 grid gap-8 lg:grid-cols-3">
        <section><h2 className="mb-4 text-xl font-semibold text-primary-dark">{t("dash.certs")}</h2>
          {certs.length ? <ul className="space-y-3">{certs.map((c) => <li key={c.id}><Link href={`/certificates/${c.publicId}`} className="card block p-4 text-sm hover:border-primary"><div className="font-semibold">{c.courseTitle}</div><div className="text-muted">{c.issuedAt.toLocaleDateString()} · {c.publicId}</div></Link></li>)}</ul> : <p className="text-sm text-muted">{t("common.none")}</p>}</section>
        <section><h2 className="mb-4 text-xl font-semibold text-primary-dark">{t("dash.quiz")}</h2>
          {attempts.length ? <ul className="card divide-y divide-border text-sm">{attempts.map((a) => <li key={a.id} className="flex justify-between gap-3 p-3"><span className="truncate">{a.quiz.titleEn}</span><span className={a.passed ? "text-success" : "text-error"}>{a.scorePct}%</span></li>)}</ul> : <p className="text-sm text-muted">{t("dash.noQuiz")}</p>}</section>
        <section><h2 className="mb-4 text-xl font-semibold text-primary-dark">{t("dash.notifications")}</h2>
          {notifications.length ? <ul className="card divide-y divide-border text-sm">{notifications.map((n) => <li key={n.id} className="p-3">{n.href ? <Link className="hover:text-primary" href={n.href}>{n.title}</Link> : n.title}<div className="text-xs text-muted">{n.createdAt.toLocaleDateString()}</div></li>)}</ul> : <p className="text-sm text-muted">{t("dash.noNotif")}</p>}</section>
      </div>

      {rec.length > 0 && <section className="mt-12"><h2 className="mb-4 text-xl font-semibold text-primary-dark">{t("dash.recommended")}</h2><div className="grid gap-6 md:grid-cols-3">{rec.map((c) => <CourseCard key={c.id} c={c} locale={locale} t={t} />)}</div></section>}
    </div>
  );
}
