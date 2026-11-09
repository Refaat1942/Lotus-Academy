import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Bookmark, BookmarkCheck, CheckCircle2, ChevronLeft, ChevronRight, Circle, Download, ExternalLink, Lock, ShieldQuestion } from "lucide-react";
import { db } from "@/lib/db";
import { enforcePathOrder } from "@/lib/paths";
import { getT, pick } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { renderMarkdown } from "@/lib/markdown";
import { lessonQuiz, markLessonViewed } from "@/lib/learning";
import { isLessonUnlocked } from "@/lib/domain";
import { themeVars } from "@/lib/category-theme";
import { bookmarkAction, completeLessonAction } from "@/app/actions/learning";
import { Progress, fmtDuration } from "@/components/ui";
import { AssistantChat } from "@/components/AssistantChat";
import { NarratedVideo } from "@/components/NarratedVideo";
import { parseScenes } from "@/lib/video-script";

export const dynamic = "force-dynamic";

function VideoEmbed({ v }: { v: { provider: string; externalId: string | null; url: string } }) {
  let src: string | null = null;
  if (v.provider === "YOUTUBE" && v.externalId && /^[\w-]{6,20}$/.test(v.externalId)) src = `https://www.youtube-nocookie.com/embed/${v.externalId}`;
  if (v.provider === "VIMEO" && v.externalId && /^\d+$/.test(v.externalId)) src = `https://player.vimeo.com/video/${v.externalId}`;
  if (src) return <div className="aspect-video overflow-hidden rounded-2xl border border-border shadow-card"><iframe src={src} title="Lesson video" className="h-full w-full" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" /></div>;
  if (/^https:\/\//.test(v.url)) return <video controls preload="metadata" className="w-full rounded-2xl border border-border" src={v.url} />;
  return null;
}

export default async function LessonPage({ params, searchParams }: { params: Promise<{ slug: string; lessonSlug: string }>; searchParams: Promise<{ cp?: string; locked?: string }> }) {
  const { slug, lessonSlug } = await params;
  const sp = await searchParams;
  const { t, locale, dir } = await getT();
  const user = await requireUser();

  const course = await db.course.findFirst({
    where: { slug, status: "PUBLISHED", deletedAt: null },
    include: { category: true, modules: { orderBy: { position: "asc" }, include: { lessons: { where: { status: "PUBLISHED", deletedAt: null }, orderBy: { position: "asc" } } } } },
  });
  if (!course) notFound();
  const enrollment = await db.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: course.id } } });
  if (!enrollment || enrollment.status === "CANCELLED") redirect(`/courses/${slug}`);
  await enforcePathOrder(user.id, course.id);

  const lessons = course.modules.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleId: m.id })));
  const idx = lessons.findIndex((l) => l.slug === lessonSlug);
  if (idx === -1) notFound();
  const lesson = lessons[idx];

  const prog = await db.lessonProgress.findMany({ where: { userId: user.id, courseId: course.id, completedAt: { not: null } }, select: { lessonId: true } });
  const done = new Set(prog.map((p) => p.lessonId));
  // Server-enforced path: a lesson is reachable only when the previous one is complete.
  if (course.sequential && !isLessonUnlocked(lessons, done, idx)) {
    const firstOpen = lessons.find((l) => !done.has(l.id)) ?? lessons[0];
    redirect(`/learn/${course.slug}/${firstOpen.slug}?locked=1`);
  }
  await markLessonViewed(user.id, lesson.id);

  const [courseProg, bookmark, quiz, videos, assets, attempts, finalExam] = await Promise.all([
    db.courseProgress.findUnique({ where: { userId_courseId: { userId: user.id, courseId: course.id } } }),
    db.bookmark.findUnique({ where: { userId_lessonId: { userId: user.id, lessonId: lesson.id } } }),
    lessonQuiz(lesson.id),
    db.video.findMany({ where: { lessonId: lesson.id, status: "READY" } }),
    db.lessonAsset.findMany({ where: { lessonId: lesson.id }, orderBy: { createdAt: "asc" } }),
    db.quizAttempt.findMany({ where: { userId: user.id, quiz: { lessonId: lesson.id }, submittedAt: { not: null } }, orderBy: { startedAt: "desc" }, take: 1 }),
    db.quiz.findFirst({ where: { courseId: course.id, lessonId: null, status: "PUBLISHED" }, select: { id: true } }),
  ]);
  const useAr = locale === "ar" && !!lesson.bodyMdAr;
  const html = renderMarkdown(useAr ? lesson.bodyMdAr! : lesson.bodyMd);
  const objectives = locale === "ar" && lesson.objectivesAr.length ? lesson.objectivesAr : lesson.objectives;
  const prev = lessons[idx - 1];
  const next = lessons[idx + 1];
  const lessonDone = done.has(lesson.id);
  const nextOpen = !!next && (!course.sequential || lessonDone);
  const remaining = lessons.length - done.size;
  const certificate = enrollment.status === "COMPLETED" || enrollment.renewalSince ? await db.certificate.findUnique({ where: { userId_courseId: { userId: user.id, courseId: course.id } } }) : null;
  const Prev = dir === "rtl" ? ChevronRight : ChevronLeft;
  const Next = dir === "rtl" ? ChevronLeft : ChevronRight;
  const here = `/learn/${course.slug}/${lesson.slug}`;
  let n = 0;

  return (
    <div style={themeVars(course.category?.slug)} className="bg-gradient-to-b from-[var(--soft)] via-background to-background">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 pb-32 pt-8 sm:px-6 lg:grid-cols-[330px_1fr]">
        <aside aria-label={t("learn.curriculum")} className="lg:sticky lg:top-28 lg:self-start">
          <details className="card overflow-hidden lg:open:block" open>
            <summary className="cursor-pointer list-none p-5 text-white lg:cursor-default" style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-dark))" }}>
              <Link href={`/courses/${course.slug}`} className="text-sm text-white/80 hover:text-white">← {pick(locale, course.titleEn, course.titleAr)}</Link>
              <div className="mt-3 flex justify-between text-sm font-semibold"><span>{t("learn.curriculum")}</span><span>{courseProg?.percent ?? 0}%</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/25"><div className="h-full rounded-full bg-white transition-[width] duration-700" style={{ width: `${courseProg?.percent ?? 0}%` }} /></div>
              <p className="mt-2 text-xs text-white/85">{done.size} {t("learn.done")} {lessons.length} · {remaining} {t("learn.remaining")}</p>
            </summary>
            <div className="max-h-[60vh] overflow-y-auto">
              {course.modules.filter((m) => m.lessons.length).map((m) => (
                <div key={m.id}>
                  {course.modules.length > 1 && <p className="bg-background px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted">{pick(locale, m.titleEn, m.titleAr)}</p>}
                  <ol className="divide-y divide-border">
                    {m.lessons.map((l) => {
                      const i = n++;
                      const open = !course.sequential || isLessonUnlocked(lessons, done, i);
                      const cur = l.id === lesson.id;
                      const inner = (<>
                        {done.has(l.id) ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" aria-label={t("learn.completed")} /> : !open ? <Lock size={16} className="mt-1 shrink-0 text-muted" aria-label="Locked" /> : <Circle size={18} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} aria-hidden />}
                        <span><span className="text-muted">{i + 1}. </span>{pick(locale, l.titleEn, l.titleAr)}<span className="block text-xs font-normal text-muted">{fmtDuration(l.durationMinutes, t)}</span></span>
                      </>);
                      return (
                        <li key={l.id}>
                          {open ? <Link href={`/learn/${course.slug}/${l.slug}`} aria-current={cur ? "page" : undefined} className={`flex items-start gap-3 p-3 text-sm transition-colors hover:bg-[var(--soft)] ${cur ? "bg-[var(--soft)] font-semibold" : ""}`}>{inner}</Link>
                            : <div className="flex items-start gap-3 p-3 text-sm text-muted opacity-70" aria-disabled="true">{inner}</div>}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
            </div>
          </details>
        </aside>

        <article className="min-w-0">
          {sp.locked && <p role="status" className="mb-4 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">Finish this lesson and answer its question to unlock the next one.</p>}
          <p className="text-sm text-muted">{idx + 1} / {lessons.length}</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: "var(--accent-dark)" }}>{pick(locale, lesson.titleEn, lesson.titleAr)}</h1>
          {locale === "en" && lesson.titleAr && <p lang="ar" dir="rtl" className="mt-1 text-muted">{lesson.titleAr}</p>}

          <div className="mt-6 space-y-6">
            {/* No recorded video yet: play the lesson's video script as a narrated scene-by-scene video. */}
            {!videos.length && (lesson.videoScriptAr || lesson.videoScriptEn) && (
              <NarratedVideo title={pick(locale, lesson.titleEn, lesson.titleAr)} initialLang={locale === "ar" ? "ar" : "en"}
                scripts={{ ...(lesson.videoScriptEn ? { en: parseScenes(lesson.videoScriptEn) } : {}), ...(lesson.videoScriptAr ? { ar: parseScenes(lesson.videoScriptAr) } : {}) }} />
            )}
            {[...videos].sort((a, b) => (a.language === locale ? -1 : 0) - (b.language === locale ? -1 : 0)).map((v) => (
              <div key={v.id} className="space-y-2">
                {videos.length > 1 && v.language !== "all" && <p className="text-xs font-semibold uppercase tracking-wider text-muted">{v.language === "ar" ? "العربية" : "English"}</p>}
                <VideoEmbed v={v} />
              </div>
            ))}
            {objectives.length > 0 && (
              <section className="card border-s-4 p-5" style={{ borderInlineStartColor: "var(--accent)" }}><h2 className="mb-2 font-bold">{t("learn.objectives")}</h2><ul className="list-disc space-y-1 ps-5 text-sm">{objectives.map((o) => <li key={o}>{o.replace(/\*\*/g, "")}</li>)}</ul></section>
            )}
            <div className="prose-lotus rounded-2xl bg-surface p-6 shadow-card sm:p-8" dir={useAr ? "rtl" : "ltr"} lang={useAr ? "ar" : "en"} dangerouslySetInnerHTML={{ __html: html }} />
            {assets.length > 0 && (
              <section className="card p-5"><h2 className="mb-3 font-bold">{t("learn.attachments")}</h2>
                <ul className="grid gap-2 sm:grid-cols-2">{assets.map((a) => (
                  <li key={a.id}>
                    {a.kind === "FILE" && a.fileId
                      ? <a href={`/api/files/${a.fileId}`} className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm font-medium transition-colors hover:bg-[var(--soft)]"><Download size={18} style={{ color: "var(--accent)" }} aria-hidden /><span className="min-w-0 flex-1 truncate">{a.name}</span><span className="text-xs text-muted">{a.sizeBytes ? `${Math.round(a.sizeBytes / 1024)} KB` : ""}</span></a>
                      : <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm font-medium transition-colors hover:bg-[var(--soft)]"><ExternalLink size={18} style={{ color: "var(--accent)" }} aria-hidden /><span className="min-w-0 flex-1 truncate">{a.name}</span></a>}
                  </li>))}</ul></section>
            )}
          </div>

          {quiz && (() => {
            const needs = lesson.requireCheckpoint;
            const served = quiz.drawCount > 0 ? Math.min(quiz.drawCount, quiz._count.questions) : quiz._count.questions;
            const last = attempts[0];
            return (
              <section id="lesson-quiz" className="mt-8 overflow-hidden rounded-2xl border-2 bg-surface shadow-card" style={{ borderColor: lessonDone ? "rgb(var(--success))" : "var(--accent)" }}>
                <div className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div className="flex items-start gap-3">
                    {lessonDone ? <CheckCircle2 size={24} className="mt-0.5 shrink-0 text-success" aria-hidden /> : <ShieldQuestion size={24} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} aria-hidden />}
                    <div>
                      <h2 className="font-bold">{t("learn.lessonQuiz")}</h2>
                      <p className="text-sm text-muted">{served} {t("learn.lessonQuiz.questions")} · {t("quiz.passMark")} {quiz.passMark}%{needs && !lessonDone ? ` · ${t("learn.lessonQuiz.required")}` : ""}</p>
                      {last && !lessonDone && !last.passed && <p role="status" className="mt-1 text-sm text-error">{t("learn.lessonQuiz.lastFailed")} {last.scorePct}%</p>}
                      {lessonDone && last?.passed && <p className="mt-1 text-sm text-success">{t("quiz.passed")} · {last.scorePct}%</p>}
                    </div>
                  </div>
                  <Link className={lessonDone ? "btn-secondary" : "btn-primary"} href={`${here}/quiz`} style={lessonDone ? undefined : { background: "var(--accent)" }}>{lessonDone ? t("learn.lessonQuiz.practice") : last && !last.passed ? t("quiz.retry") : t("learn.lessonQuiz.start")}</Link>
                </div>
              </section>
            );
          })()}
          {enrollment.renewalSince && finalExam && (
            <section className="mt-8 rounded-2xl border-2 border-warning/50 bg-warning/10 p-5"><h2 className="font-bold">{t("learn.renewal")}</h2><p className="mt-1 text-sm text-muted">{t("learn.renewal.desc")}{enrollment.dueAt ? ` ${enrollment.dueAt.toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB")}` : ""}</p><Link className="btn-primary mt-3" href={`/learn/${course.slug}/final-exam`}>{t("learn.renewal.start")}</Link></section>
          )}
          {!next && lessonDone && finalExam && !certificate && (
            <section className="mt-8 rounded-2xl border-2 p-5" style={{ borderColor: "var(--accent)", background: "var(--soft)" }}><h2 className="font-bold">{t("learn.finalExam")}</h2><p className="mt-1 text-sm text-muted">{t("learn.finalExam.desc")}</p><Link className="btn-primary mt-3" href={`/learn/${course.slug}/final-exam`} style={{ background: "var(--accent)" }}>{t("learn.finalExam.start")}</Link></section>
          )}
          {certificate && !enrollment.renewalSince && (
            <section className="mt-8 rounded-2xl border border-success/30 bg-success/10 p-5"><h2 className="font-bold text-success">{t("learn.courseDone")}</h2><Link className="btn-primary mt-3" href={`/certificates/${certificate.publicId}`}>{t("learn.viewCert")}</Link></section>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
            <div className="flex flex-wrap gap-2">
              <form action={bookmarkAction}><input type="hidden" name="lessonId" value={lesson.id} /><button className="btn-secondary" type="submit">{bookmark ? <BookmarkCheck size={16} aria-hidden /> : <Bookmark size={16} aria-hidden />}{bookmark ? t("learn.bookmarked") : t("learn.bookmark")}</button></form>
              {lessonDone ? <span className="btn-secondary !cursor-default text-success"><CheckCircle2 size={16} aria-hidden />{t("learn.completed")}</span>
                : !(quiz && lesson.requireCheckpoint) ? <form action={completeLessonAction}><input type="hidden" name="lessonId" value={lesson.id} /><button className="btn-primary" type="submit">{t("learn.complete")}</button></form> : null}
            </div>
            <div className="flex gap-2">
              {prev && <Link className="btn-secondary" href={`/learn/${course.slug}/${prev.slug}`}><Prev size={16} aria-hidden />{t("learn.prev")}</Link>}
              {next && (nextOpen
                ? <Link className="btn-primary" href={`/learn/${course.slug}/${next.slug}`}>{t("learn.next")}<Next size={16} aria-hidden /></Link>
                : <span className="btn-secondary !cursor-not-allowed opacity-60" aria-disabled="true"><Lock size={15} aria-hidden />{t("learn.next")}</span>)}
            </div>
          </div>
          <p className="mt-10 text-center text-xs text-muted">{t("legal.copyright")}</p>
        </article>
      </div>
      <AssistantChat courseId={course.id} lessonId={lesson.id} />
    </div>
  );
}
