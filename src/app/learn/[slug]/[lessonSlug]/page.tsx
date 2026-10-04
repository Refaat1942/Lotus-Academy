import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Bookmark, BookmarkCheck, CheckCircle2, Circle, ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { getT, pick } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { renderMarkdown } from "@/lib/markdown";
import { markLessonViewed } from "@/lib/learning";
import { bookmarkAction, completeLessonAction } from "@/app/actions/learning";
import { Progress, fmtDuration } from "@/components/ui";

export const dynamic = "force-dynamic";

function VideoEmbed({ v }: { v: { provider: string; externalId: string | null; url: string } }) {
  let src: string | null = null;
  if (v.provider === "YOUTUBE" && v.externalId && /^[\w-]{6,20}$/.test(v.externalId)) src = `https://www.youtube-nocookie.com/embed/${v.externalId}`;
  if (v.provider === "VIMEO" && v.externalId && /^\d+$/.test(v.externalId)) src = `https://player.vimeo.com/video/${v.externalId}`;
  if (src) return <div className="aspect-video overflow-hidden rounded-lg border border-border"><iframe src={src} title="Lesson video" className="h-full w-full" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" /></div>;
  if (/^https:\/\//.test(v.url)) return <video controls preload="metadata" className="w-full rounded-lg border border-border" src={v.url} />;
  return null;
}

export default async function LessonPage({ params }: { params: Promise<{ slug: string; lessonSlug: string }> }) {
  const { slug, lessonSlug } = await params;
  const { t, locale, dir } = await getT();
  const user = await requireUser();

  const course = await db.course.findFirst({
    where: { slug, status: "PUBLISHED", deletedAt: null },
    include: { modules: { orderBy: { position: "asc" }, include: { lessons: { where: { status: "PUBLISHED", deletedAt: null }, orderBy: { position: "asc" } } } } },
  });
  if (!course) notFound();
  const enrollment = await db.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: course.id } } });
  if (!enrollment || enrollment.status === "CANCELLED") redirect(`/courses/${slug}`);

  const lessons = course.modules.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleTitle: pick(locale, m.titleEn, m.titleAr) })));
  const idx = lessons.findIndex((l) => l.slug === lessonSlug);
  if (idx === -1) notFound();
  const lesson = lessons[idx];
  await markLessonViewed(user.id, lesson.id);

  const [prog, courseProg, bookmark, quiz, videos, assets, attempts] = await Promise.all([
    db.lessonProgress.findMany({ where: { userId: user.id, courseId: course.id, completedAt: { not: null } }, select: { lessonId: true } }),
    db.courseProgress.findUnique({ where: { userId_courseId: { userId: user.id, courseId: course.id } } }),
    db.bookmark.findUnique({ where: { userId_lessonId: { userId: user.id, lessonId: lesson.id } } }),
    db.quiz.findFirst({ where: { lessonId: lesson.id, status: "PUBLISHED" }, include: { _count: { select: { questions: true } } } }),
    db.video.findMany({ where: { lessonId: lesson.id, status: "READY" } }),
    db.lessonAsset.findMany({ where: { lessonId: lesson.id } }),
    db.quizAttempt.findMany({ where: { userId: user.id, quiz: { lessonId: lesson.id }, submittedAt: { not: null } }, orderBy: { startedAt: "desc" }, take: 1 }),
  ]);
  const done = new Set(prog.map((p) => p.lessonId));
  const html = renderMarkdown(lesson.bodyMd);
  const prev = lessons[idx - 1];
  const next = lessons[idx + 1];
  const remaining = lessons.length - done.size;
  const certificate = enrollment.status === "COMPLETED" ? await db.certificate.findUnique({ where: { userId_courseId: { userId: user.id, courseId: course.id } } }) : null;
  const Prev = dir === "rtl" ? ChevronRight : ChevronLeft;
  const Next = dir === "rtl" ? ChevronLeft : ChevronRight;

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[320px_1fr]">
      <aside aria-label={t("learn.curriculum")} className="lg:sticky lg:top-24 lg:self-start">
        <details className="card lg:open:block" open>
          <summary className="cursor-pointer list-none p-4 lg:cursor-default">
            <Link href={`/courses/${course.slug}`} className="text-sm text-muted hover:text-primary">← {pick(locale, course.titleEn, course.titleAr)}</Link>
            <div className="mt-3 flex justify-between text-sm"><span className="font-semibold">{t("learn.curriculum")}</span><span>{courseProg?.percent ?? 0}%</span></div>
            <div className="mt-2"><Progress value={courseProg?.percent ?? 0} /></div>
            <p className="mt-2 text-xs text-muted">{done.size} {t("learn.done")} {lessons.length} · {remaining} {t("learn.remaining")}</p>
          </summary>
          <ol className="max-h-[60vh] divide-y divide-border overflow-y-auto border-t border-border">
            {lessons.map((l, i) => (
              <li key={l.id}>
                <Link href={`/learn/${course.slug}/${l.slug}`} aria-current={l.id === lesson.id ? "page" : undefined} className={`flex items-start gap-3 p-3 text-sm hover:bg-primary-light ${l.id === lesson.id ? "bg-primary-light font-semibold" : ""}`}>
                  {done.has(l.id) ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" aria-label={t("learn.completed")} /> : <Circle size={18} className="mt-0.5 shrink-0 text-muted" aria-hidden />}
                  <span><span className="text-muted">{i + 1}. </span>{pick(locale, l.titleEn, l.titleAr)}<span className="block text-xs font-normal text-muted">{fmtDuration(l.durationMinutes, t)}</span></span>
                </Link>
              </li>
            ))}
          </ol>
        </details>
      </aside>

      <article>
        <p className="text-sm text-muted">{i18nCount(idx + 1, lessons.length)}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-primary-dark sm:text-3xl">{pick(locale, lesson.titleEn, lesson.titleAr)}</h1>
        {locale === "en" && lesson.titleAr && <p lang="ar" dir="rtl" className="mt-1 text-muted">{lesson.titleAr}</p>}

        <div className="mt-6 space-y-6">
          {videos.map((v) => <VideoEmbed key={v.id} v={v} />)}
          {lesson.objectives.length > 0 && (
            <section className="card p-5"><h2 className="mb-2 font-semibold">{t("learn.objectives")}</h2><ul className="list-disc space-y-1 ps-5 text-sm">{lesson.objectives.map((o) => <li key={o}>{o.replace(/\*\*/g, "")}</li>)}</ul></section>
          )}
          <div className="prose-lotus" dir="ltr" lang="en" dangerouslySetInnerHTML={{ __html: html }} />
          {assets.length > 0 && <section><h2 className="mb-2 font-semibold">{t("learn.attachments")}</h2><ul className="space-y-1 text-sm">{assets.map((a) => <li key={a.id}><a className="text-primary underline" href={a.url} rel="noopener noreferrer">{a.name}</a></li>)}</ul></section>}
        </div>

        {quiz && (
          <section className="card mt-8 flex flex-wrap items-center justify-between gap-4 p-5">
            <div><h2 className="font-semibold">{t("quiz.title")}</h2><p className="text-sm text-muted">{quiz._count.questions} · {t("quiz.passMark")} {quiz.passMark}%{attempts[0] ? ` · ${t("quiz.score")}: ${attempts[0].scorePct}% (${attempts[0].passed ? t("quiz.passed") : t("quiz.failed")})` : ""}</p></div>
            <Link className="btn-secondary" href={`/learn/${course.slug}/${lesson.slug}/quiz`}>{t("learn.quiz")}</Link>
          </section>
        )}

        {certificate && (
          <section className="mt-8 rounded-lg border border-success/30 bg-success/10 p-5"><h2 className="font-semibold text-success">{t("learn.courseDone")}</h2><Link className="btn-primary mt-3" href={`/certificates/${certificate.publicId}`}>{t("learn.viewCert")}</Link></section>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
          <div className="flex gap-2">
            <form action={bookmarkAction}><input type="hidden" name="lessonId" value={lesson.id} /><button className="btn-secondary" type="submit">{bookmark ? <BookmarkCheck size={16} aria-hidden /> : <Bookmark size={16} aria-hidden />}{bookmark ? t("learn.bookmarked") : t("learn.bookmark")}</button></form>
            {done.has(lesson.id) ? <span className="btn-secondary !cursor-default text-success"><CheckCircle2 size={16} aria-hidden />{t("learn.completed")}</span>
              : <form action={completeLessonAction}><input type="hidden" name="lessonId" value={lesson.id} /><button className="btn-primary" type="submit">{t("learn.complete")}</button></form>}
          </div>
          <div className="flex gap-2">
            {prev && <Link className="btn-secondary" href={`/learn/${course.slug}/${prev.slug}`}><Prev size={16} aria-hidden />{t("learn.prev")}</Link>}
            {next && <Link className="btn-primary" href={`/learn/${course.slug}/${next.slug}`}>{t("learn.next")}<Next size={16} aria-hidden /></Link>}
          </div>
        </div>
      </article>
    </div>
  );
}

const i18nCount = (n: number, total: number) => `${n} / ${total}`;
