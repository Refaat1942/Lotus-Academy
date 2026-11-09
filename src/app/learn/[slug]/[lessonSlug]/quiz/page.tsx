import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { enforcePathOrder } from "@/lib/paths";
import { getT, pick } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { isLessonUnlocked } from "@/lib/domain";
import { lessonQuiz, startAttempt } from "@/lib/learning";
import { QuizTaker } from "@/components/QuizTaker";

export const dynamic = "force-dynamic";

export default async function QuizPage({ params }: { params: Promise<{ slug: string; lessonSlug: string }> }) {
  const { slug, lessonSlug } = await params;
  const { t, locale } = await getT();
  const user = await requireUser();
  const course = await db.course.findFirst({ where: { slug, status: "PUBLISHED", deletedAt: null }, include: { lessons: { where: { status: "PUBLISHED", deletedAt: null }, orderBy: { position: "asc" }, select: { id: true, slug: true } } } });
  if (!course) notFound();
  const idx = course.lessons.findIndex((l) => l.slug === lessonSlug);
  if (idx === -1) notFound();
  const enr = await db.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: course.id } } });
  if (!enr || enr.status === "CANCELLED") redirect(`/courses/${slug}`);
  await enforcePathOrder(user.id, course.id);
  const done = new Set((await db.lessonProgress.findMany({ where: { userId: user.id, courseId: course.id, completedAt: { not: null } }, select: { lessonId: true } })).map((p) => p.lessonId));
  if (course.sequential && !isLessonUnlocked(course.lessons, done, idx)) redirect(`/learn/${slug}/${lessonSlug}`);
  const back = `/learn/${slug}/${lessonSlug}`;
  const quiz = await lessonQuiz(course.lessons[idx].id);
  if (!quiz) return <div className="mx-auto max-w-2xl px-4 py-16"><p>{t("quiz.none")}</p><Link href={back} className="btn-secondary mt-4">{t("quiz.backToLesson")}</Link></div>;
  const [view, history] = await Promise.all([
    startAttempt(user.id, quiz.id),
    db.quizAttempt.findMany({ where: { userId: user.id, quizId: quiz.id, submittedAt: { not: null } }, orderBy: { startedAt: "desc" } }),
  ]);
  return <QuizTaker title={pick(locale, quiz.titleEn, quiz.titleAr)} passMark={quiz.passMark} view={view} backHref={back} backLabel={t("quiz.backToLesson")} history={history} />;
}
