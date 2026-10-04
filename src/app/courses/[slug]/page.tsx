import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Award, BookOpen, Clock } from "lucide-react";
import { db } from "@/lib/db";
import { getT, pick } from "@/i18n";
import { getCurrentUser } from "@/lib/auth";
import { enrollAction } from "@/app/actions/learning";
import { Badge, Progress, fmtDuration } from "@/components/ui";
import { CourseCard } from "@/components/CourseCard";
import { listCourses } from "@/lib/catalog";
import { resumeLesson } from "@/lib/domain";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  return db.course.findFirst({
    where: { slug, status: "PUBLISHED", deletedAt: null },
    include: {
      category: true,
      instructors: { include: { instructor: { include: { user: true } } } },
      modules: { orderBy: { position: "asc" }, include: { lessons: { where: { status: "PUBLISHED", deletedAt: null }, orderBy: { position: "asc" }, select: { id: true, slug: true, titleEn: true, titleAr: true, durationMinutes: true, isPreview: true } } } },
    },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = await load((await params).slug);
  return { title: c?.titleEn ?? "Course", description: c?.summaryEn ?? undefined };
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { t, locale } = await getT();
  const course = await load(slug);
  if (!course) notFound();
  const user = await getCurrentUser();
  const enrollment = user ? await db.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: course.id } } }) : null;
  const enrolled = !!enrollment && enrollment.status !== "CANCELLED";
  const [progress, done, related] = await Promise.all([
    user ? db.courseProgress.findUnique({ where: { userId_courseId: { userId: user.id, courseId: course.id } } }) : null,
    user ? db.lessonProgress.findMany({ where: { userId: user.id, courseId: course.id, completedAt: { not: null } }, select: { lessonId: true } }) : [],
    listCourses({ category: course.category?.slug }),
  ]);
  const lessons = course.modules.flatMap((m) => m.lessons);
  const doneSet = new Set(done.map((d) => d.lessonId));
  const resumeId = resumeLesson(lessons, doneSet, enrollment?.lastLessonId ?? null);
  const resume = lessons.find((l) => l.id === resumeId);
  const objectives = locale === "ar" && course.objectivesAr.length ? course.objectivesAr : course.objectivesEn;
  const title = pick(locale, course.titleEn, course.titleAr);
  const strip = (s: string) => s.replace(/\*\*/g, "");

  return (
    <>
      <section className="bg-gradient-to-br from-primary to-primary-dark text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <nav aria-label="Breadcrumb" className="mb-4 text-sm text-white/70"><Link href="/courses" className="hover:text-white">{t("nav.courses")}</Link> / {course.category && pick(locale, course.category.nameEn, course.category.nameAr)}</nav>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
            <p dir="auto" className="mt-4 max-w-2xl text-white/85">{pick(locale, course.summaryEn, course.summaryAr)}</p>
            <div className="mt-6 flex flex-wrap items-center gap-5 text-sm text-white/85">
              <span className="inline-flex items-center gap-1.5"><BookOpen size={16} aria-hidden />{lessons.length} {t("common.lessons")}</span>
              <span className="inline-flex items-center gap-1.5"><Clock size={16} aria-hidden />{fmtDuration(course.durationMinutes, t)}</span>
              <span>{t(`level.${course.level}` as "level.BEGINNER")}</span>
            </div>
          </div>
          <aside className="card self-start p-6 text-text">
            {enrolled ? (
              <>
                <div className="mb-1 flex justify-between text-sm"><span>{enrollment!.status === "COMPLETED" ? t("courses.completed") : t("courses.enrolled")}</span><span>{progress?.percent ?? 0}%</span></div>
                <Progress value={progress?.percent ?? 0} />
                {resume && <Link href={`/learn/${course.slug}/${resume.slug}`} className="btn-primary mt-5 w-full">{enrollment!.status === "COMPLETED" ? t("courses.review") : t("courses.continue")}</Link>}
              </>
            ) : user ? (
              <form action={enrollAction}><input type="hidden" name="courseId" value={course.id} /><button className="btn-primary w-full" type="submit">{t("courses.enroll")}</button></form>
            ) : (
              <Link href={`/login?next=/courses/${course.slug}`} className="btn-primary w-full">{t("courses.signin")}</Link>
            )}
            <div className="mt-5 flex gap-3 text-sm text-muted"><Award size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden /><div><div className="font-medium text-text">{t("courses.certificate")}</div>{t("courses.certificate.d")}</div></div>
          </aside>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-12 sm:px-6 lg:grid-cols-3">
        <div className="space-y-12 lg:col-span-2">
          {course.descriptionEn && <section><p dir="auto" className="text-lg leading-8 text-text/90">{pick(locale, course.descriptionEn, course.descriptionAr)}</p></section>}
          {objectives.length > 0 && (
            <section><h2 className="mb-4 text-xl font-semibold text-primary-dark">{t("courses.objectives")}</h2>
              <ul className="grid gap-3 sm:grid-cols-2">{objectives.map((o) => <li key={o} dir="auto" className="card p-4 text-sm">{strip(o)}</li>)}</ul></section>
          )}
          <section><h2 className="mb-4 text-xl font-semibold text-primary-dark">{t("courses.curriculum")}</h2>
            {course.modules.map((m) => (
              <div key={m.id} className="card divide-y divide-border">
                {m.lessons.map((l, i) => (
                  <div key={l.id} className="flex items-center gap-4 p-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-light text-sm font-semibold text-primary-dark">{doneSet.has(l.id) ? "✓" : i + 1}</span>
                    <div className="flex-1"><div className="font-medium">{pick(locale, l.titleEn, l.titleAr)}</div><div className="text-xs text-muted">{fmtDuration(l.durationMinutes, t)}</div></div>
                    {l.isPreview && !enrolled && <Badge tone="primary">{t("courses.preview")}</Badge>}
                  </div>
                ))}
              </div>
            ))}
          </section>
        </div>
        <aside className="space-y-8">
          <section><h2 className="mb-3 font-semibold">{t("courses.instructor")}</h2>
            {course.instructors.length ? course.instructors.map((i) => <div key={i.instructorId} className="card p-4 text-sm">{i.instructor.user.firstName} {i.instructor.user.lastName}</div>) : <p className="text-sm text-muted">{t("courses.noInstructor")}</p>}</section>
          {course.prerequisitesEn && <section><h2 className="mb-3 font-semibold">{t("courses.prereq")}</h2><p className="text-sm text-muted">{course.prerequisitesEn}</p></section>}
        </aside>
      </div>

      {related.items.filter((c) => c.id !== course.id).length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6"><h2 className="mb-6 text-xl font-semibold text-primary-dark">{t("courses.related")}</h2>
          <div className="grid gap-6 md:grid-cols-3">{related.items.filter((c) => c.id !== course.id).slice(0, 3).map((c) => <CourseCard key={c.id} c={c} locale={locale} t={t} />)}</div></section>
      )}
    </>
  );
}
