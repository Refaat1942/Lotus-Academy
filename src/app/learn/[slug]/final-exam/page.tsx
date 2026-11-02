import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getT, pick } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { startAttempt } from "@/lib/learning";
import { QuizTaker } from "@/components/QuizTaker";

export const dynamic = "force-dynamic";

export default async function FinalExam({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { t, locale } = await getT();
  const user = await requireUser();
  const course = await db.course.findFirst({ where: { slug, status: "PUBLISHED", deletedAt: null } });
  if (!course) notFound();
  const enr = await db.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: course.id } } });
  if (!enr || enr.status === "CANCELLED") redirect(`/courses/${slug}`);
  const [total, done] = await Promise.all([
    db.lesson.count({ where: { courseId: course.id, status: "PUBLISHED", deletedAt: null } }),
    db.lessonProgress.count({ where: { userId: user.id, courseId: course.id, completedAt: { not: null }, lesson: { status: "PUBLISHED", deletedAt: null } } }),
  ]);
  if (done < total) redirect(`/courses/${slug}?exam=locked`); // server-enforced
  const quiz = await db.quiz.findFirst({ where: { courseId: course.id, lessonId: null, status: "PUBLISHED" } });
  if (!quiz) notFound();
  const [view, history] = await Promise.all([
    startAttempt(user.id, quiz.id),
    db.quizAttempt.findMany({ where: { userId: user.id, quizId: quiz.id, submittedAt: { not: null } }, orderBy: { startedAt: "desc" } }),
  ]);
  return <QuizTaker title={pick(locale, quiz.titleEn, quiz.titleAr)} passMark={quiz.passMark} view={view} backHref={`/courses/${slug}`} backLabel={t("common.back")} history={history} />;
}
