import Link from "next/link";
import { db } from "@/lib/db";
import { getT, pick } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { resumeLesson } from "@/lib/domain";
import { visibleCoursesWhere, audienceOf } from "@/lib/audience";
import { listCourses } from "@/lib/catalog";
import { CourseCard } from "@/components/CourseCard";
import { EmptyState, Progress, StatCard } from "@/components/ui";
import { DailyQuestion } from "@/components/DailyQuestion";
import { PathSteps } from "@/components/PathSteps";
import { getDaily, leaderboard } from "@/lib/engagement";
import { myPaths } from "@/lib/paths";
import { certState } from "@/lib/learning";
import { hasTeamView } from "@/lib/team";

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
  const [daily, paths, score, team] = await Promise.all([getDaily(user.id), myPaths(user.id), leaderboard({ id: user.id }), hasTeamView(user)]);
  const activePath = paths.find((p) => !p.enrollment.completedAt) ?? paths[0];
  const renewals = certs.filter((c) => ["expiring", "expired"].includes(certState(c)));
  const tx = (en: string, a: string) => (locale === "ar" ? a : en);
  const rec = (await listCourses({ sort: "popular", visible: visibleCoursesWhere(user, await audienceOf(user.id)) })).items.filter((c) => !enrolledIds.has(c.id)).slice(0, 3);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      {sp.denied && <p role="alert" className="mb-6 rounded border border-warning/40 bg-warning/10 px-4 py-3 text-sm">{t("dash.denied")}</p>}
      <h1 className="text-3xl font-semibold tracking-tight text-primary-dark">{t("dash.welcome")}, {user.firstName}</h1>

      {team && (
        <Link href="/team" className="mt-6 flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-primary-dark to-primary p-5 text-white shadow-lift">
          <span><span className="block text-lg font-extrabold">{tx("My team's training", "تدريب فريقي")}</span><span className="text-sm text-white/85">{tx("See who is on track and who needs a reminder.", "تابع من يسير على الخطة ومن يحتاج تذكيرًا.")}</span></span>
          <span className="btn-secondary !border-white/40 !bg-white/10 !text-white">{tx("Open", "افتح")} →</span>
        </Link>
      )}

      {renewals.length > 0 && (
        <section className="mt-6 rounded-2xl border-2 border-warning/50 bg-warning/10 p-5">
          <h2 className="font-extrabold text-primary-dark">{tx("Certificates to renew", "شهادات تحتاج تجديد")}</h2>
          <ul className="mt-2 space-y-2 text-sm">{renewals.map((c) => {
            const e = enrollments.find((x) => x.courseId === c.courseId);
            return <li key={c.id} className="flex flex-wrap items-center justify-between gap-2"><span>{e ? pick(locale, e.course.titleEn, e.course.titleAr) : c.courseTitle} — {certState(c) === "expired" ? tx("expired", "منتهية") : tx("expires", "تنتهي")} {c.expiresAt!.toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB")}</span>
              {e && <Link href={`/learn/${e.course.slug}/final-exam`} className="btn-primary !py-1.5 text-xs">{tx("Retake the final exam", "أعد الامتحان النهائي")}</Link>}</li>;
          })}</ul>
          <p className="mt-2 text-xs text-muted">{tx("Retake the final exam of the course to renew. Your lessons stay complete.", "أعد الامتحان النهائي للكورس للتجديد. تبقى دروسك مكتملة.")}</p>
        </section>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.15fr]">
        <DailyQuestion d={daily} locale={locale} />
        {activePath ? (
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-lg font-extrabold text-primary-dark">{tx("My learning path", "مساري التعليمي")}</h2><Link href={`/paths/${activePath.path.slug}`} className="text-sm font-semibold text-primary hover:underline">{pick(locale, activePath.path.titleEn, activePath.path.titleAr)} · {activePath.percent}%</Link></div>
            <PathSteps steps={activePath.steps.slice(0, 4)} locale={locale} />
          </section>
        ) : (
          <section className="card flex flex-col justify-between p-5">
            <div><h2 className="text-lg font-extrabold text-primary-dark">{tx("My points", "نقاطي")}</h2><p className="mt-2 text-4xl font-extrabold text-primary">{score[0]?.points ?? 0}</p><p className="text-sm text-muted">{tx("Complete lessons, earn certificates and answer the daily question to climb the leaderboard.", "أكمل الدروس واحصل على الشهادات وأجب عن سؤال اليوم لتتقدّم في لوحة الصدارة.")}</p></div>
            <Link href="/leaderboard" className="btn-secondary mt-4 self-start">{tx("View leaderboard", "عرض لوحة الصدارة")}</Link>
          </section>
        )}
      </div>

      {(() => {
        const required = enrollments.filter((e) => e.source === "assigned" && e.status !== "COMPLETED");
        if (!required.length) return null;
        const now = new Date();
        return (
          <section className="mt-8 rounded-2xl border-2 border-warning/40 bg-warning/5 p-5">
            <h2 className="mb-3 text-lg font-extrabold text-primary-dark">{t("dash.required")}</h2>
            <ul className="grid gap-3 md:grid-cols-2">
              {required.map((e) => {
                const overdue = !!e.dueAt && e.dueAt < now;
                return (
                  <li key={e.id}><Link href={`/courses/${e.course.slug}`} className="card flex items-center justify-between gap-3 p-4 hover:border-primary">
                    <span className="min-w-0"><span className="block font-semibold">{pick(locale, e.course.titleEn, e.course.titleAr)}</span>
                      {e.dueAt && <span className={`text-xs ${overdue ? "font-bold text-error" : "text-muted"}`}>{overdue ? t("dash.overdue") : t("dash.due")}: {e.dueAt.toLocaleDateString()}</span>}</span>
                    {e.renewalSince ? <span className="badge bg-warning/15 text-warning">{tx("Renewal", "تجديد")}</span> : <span className="text-sm font-semibold text-primary">{pm.get(e.courseId) ?? 0}%</span>}
                  </Link></li>
                );
              })}
            </ul>
          </section>
        );
      })()}

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
      <p className="mt-2 text-end text-sm"><Link href="/leaderboard" className="font-semibold text-primary hover:underline">{tx("My points", "نقاطي")}: {score[0]?.points ?? 0} →</Link></p>

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
