import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getT } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { attemptsRemaining } from "@/lib/domain";
import { QuizTaker } from "@/components/QuizTaker";

export const dynamic = "force-dynamic";

export default async function QuizPage({ params }: { params: Promise<{ slug: string; lessonSlug: string }> }) {
  const { slug, lessonSlug } = await params;
  const { t } = await getT();
  const user = await requireUser();
  const lesson = await db.lesson.findFirst({ where: { slug: lessonSlug, status: "PUBLISHED", course: { slug, status: "PUBLISHED" }, deletedAt: null } });
  if (!lesson) notFound();
  const enr = await db.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: lesson.courseId } } });
  if (!enr || enr.status === "CANCELLED") redirect(`/courses/${slug}`);
  const quiz = await db.quiz.findFirst({
    where: { lessonId: lesson.id, status: "PUBLISHED" },
    include: { questions: { orderBy: { position: "asc" }, select: { id: true, type: true, promptEn: true, promptAr: true, options: { orderBy: { position: "asc" }, select: { id: true, textEn: true, textAr: true } } } } },
  });
  const back = `/learn/${slug}/${lessonSlug}`;
  if (!quiz) return <div className="mx-auto max-w-2xl px-4 py-16"><p>{t("quiz.none")}</p><Link href={back} className="btn-secondary mt-4">{t("quiz.backToLesson")}</Link></div>;
  const history = await db.quizAttempt.findMany({ where: { userId: user.id, quizId: quiz.id, submittedAt: { not: null } }, orderBy: { startedAt: "desc" } });
  return <QuizTaker quiz={quiz} backHref={back} backLabel={t("quiz.backToLesson")} left={attemptsRemaining(quiz.maxAttempts, history.length)} history={history} />;
}
