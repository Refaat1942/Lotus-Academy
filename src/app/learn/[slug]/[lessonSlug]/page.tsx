import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Bookmark, BookmarkCheck, CheckCircle2, ChevronLeft, ChevronRight, Circle, Download, ExternalLink, Lock, ShieldQuestion } from "lucide-react";
import { db } from "@/lib/db";
import { getT, pick } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { renderMarkdown } from "@/lib/markdown";
import { getCheckpoint, markLessonViewed } from "@/lib/learning";
import { isLessonUnlocked } from "@/lib/domain";
import { themeVars } from "@/lib/category-theme";
import { bookmarkAction, completeLessonAction, submitCheckpointAction } from "@/app/actions/learning";
import { Progress, fmtDuration } from "@/components/ui";
import { AssistantChat } from "@/components/AssistantChat";

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

  const [courseProg, bookmark, quiz, videos, assets, attempts, checkpoint, finalExam] = await Promise.all([
    db.courseProgress.findUnique({ where: { userId_courseId: { userId: user.id, courseId: course.id } } }),
    db.bookmark.findUnique({ where: { userId_lessonId: { userId: user.id, lessonId: lesson.id } } }),
    db.quiz.findFirst({ where: { lessonId: lesson.id, status: "PUBLISHED" }, include: { _count: { select: { questions: true } } } }),
    db.video.findMany({ where: { lessonId: lesson.id, status: "READY" } }),
    db.lessonAsset.findMany({ where: { lessonId: lesson.id }, orderBy: { createdAt: "asc" } }),
    db.quizAttempt.findMany({ where: { userId: user.id, quiz: { lessonId: lesson.id }, submittedAt: { not: null } }, orderBy: { startedAt: "desc" }, take: 1 }),
    done.has(lesson.id) ? null : getCheckpoint(user.id, lesson.id),
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
  const certificate = enrollment.status === "COMPLETED" ? await db.certificate.findUnique({ where: { userId_courseId: { userId: user.id, courseId: course.id } } }) : null;
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

          {checkpoint?.required && !checkpoint.passed && (
            <section id="checkpoint" className="mt-8 overflow-hidden rounded-2xl border-2 bg-surface shadow-card" style={{ borderColor: "var(--accent)" }}>
              <div className="flex items-center gap-3 px-6 py-4 text-white" style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-dark))" }}>
                <ShieldQuestion size={22} aria-hidden /><div><h2 className="font-bold">Check your understanding</h2><p className="text-xs text-white/85">Answer correctly to complete this lesson and unlock the next.</p></div>
              </div>
              {sp.cp === "fail" && <p role="alert" className="border-b border-error/30 bg-error/10 px-6 py-3 text-sm text-error">Not quite. Review the lesson above and try these new questions.</p>}
              <form action={submitCheckpointAction} className="space-y-6 p-6">
                <input type="hidden" name="lessonId" value={lesson.id} /><input type="hidden" name="back" value={here} />
                {checkpoint.questions.map((q, qi) => (
                  <fieldset key={q.id}>
                    <legend className="font-semibold" dir="auto"><span className="text-muted">{qi + 1}. </span>{pick(locale, q.prompt, q.promptAr)}</legend>
                    <p className="mb-2 text-xs text-muted">{q.multi ? t("quiz.multi") : t("quiz.single")}</p>
                    <div className="space-y-2">{q.options.map((o) => (
                      <label key={o.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-sm transition-colors hover:bg-[var(--soft)] has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--soft)]">
                        <input type={q.multi ? "checkbox" : "radio"} name={`q_${q.id}`} value={o.id} required={!q.multi} className="mt-1" /><span dir="auto">{pick(locale, o.text, o.textAr)}</span>
                      </label>))}</div>
                  </fieldset>
                ))}
                <button className="btn-primary" type="submit" style={{ background: "var(--accent)" }}>Submit answer{checkpoint.questions.length > 1 ? "s" : ""}</button>
              </form>
            </section>
          )}
          {sp.cp === "pass" && <p role="status" className="mt-6 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-success">Correct! Lesson completed{next ? ", next lesson unlocked." : "."}</p>}

          {quiz && (
            <section className="card mt-8 flex flex-wrap items-center justify-between gap-4 p-5">
              <div><h2 className="font-bold">{t("quiz.title")}</h2><p className="text-sm text-muted">{quiz._count.questions} · {t("quiz.passMark")} {quiz.passMark}%{attempts[0] ? ` · ${t("quiz.score")}: ${attempts[0].scorePct}% (${attempts[0].passed ? t("quiz.passed") : t("quiz.failed")})` : ""}</p></div>
              <Link className="btn-secondary" href={`${here}/quiz`}>{t("learn.quiz")}</Link>
            </section>
          )}
          {!next && lessonDone && finalExam && !certificate && (
            <section className="mt-8 rounded-2xl border-2 p-5" style={{ borderColor: "var(--accent)", background: "var(--soft)" }}><h2 className="font-bold">{t("learn.finalExam")}</h2><p className="mt-1 text-sm text-muted">{t("learn.finalExam.desc")}</p><Link className="btn-primary mt-3" href={`/learn/${course.slug}/final-exam`} style={{ background: "var(--accent)" }}>{t("learn.finalExam.start")}</Link></section>
          )}
          {certificate && (
            <section className="mt-8 rounded-2xl border border-success/30 bg-success/10 p-5"><h2 className="font-bold text-success">{t("learn.courseDone")}</h2><Link className="btn-primary mt-3" href={`/certificates/${certificate.publicId}`}>{t("learn.viewCert")}</Link></section>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
            <div className="flex flex-wrap gap-2">
              <form action={bookmarkAction}><input type="hidden" name="lessonId" value={lesson.id} /><button className="btn-secondary" type="submit">{bookmark ? <BookmarkCheck size={16} aria-hidden /> : <Bookmark size={16} aria-hidden />}{bookmark ? t("learn.bookmarked") : t("learn.bookmark")}</button></form>
              {lessonDone ? <span className="btn-secondary !cursor-default text-success"><CheckCircle2 size={16} aria-hidden />{t("learn.completed")}</span>
                : !checkpoint?.required ? <form action={completeLessonAction}><input type="hidden" name="lessonId" value={lesson.id} /><button className="btn-primary" type="submit">{t("learn.complete")}</button></form> : null}
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
