import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getT, pick } from "@/i18n";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function QuizResult({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const { t, locale } = await getT();
  const user = await requireUser();
  const attempt = await db.quizAttempt.findFirst({
    where: { id: attemptId, userId: user.id }, // owner-only
    include: { quiz: { include: { lesson: { include: { course: true } }, questions: { orderBy: { position: "asc" }, include: { options: { orderBy: { position: "asc" } } } } } }, answers: true },
  });
  if (!attempt) notFound();
  const lesson = attempt.quiz.lesson;
  const course = await db.course.findUnique({ where: { id: attempt.quiz.courseId }, select: { slug: true } });
  const back = lesson ? `/learn/${lesson.course.slug}/${lesson.slug}` : `/courses/${course?.slug ?? ""}`;
  const retry = lesson ? `${back}/quiz` : `/learn/${course?.slug}/final-exam`;
  const byQ = new Map(attempt.answers.map((a) => [a.questionId, a]));
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className={`rounded-lg border p-6 ${attempt.passed ? "border-success/30 bg-success/10" : "border-error/30 bg-error/10"}`} role="status">
        <h1 className="text-2xl font-semibold">{attempt.passed ? t("quiz.passed") : t("quiz.failed")}</h1>
        <p className="mt-1 text-sm">{t("quiz.score")}: <strong>{attempt.scorePct}%</strong> · {t("quiz.passMark")}: {attempt.quiz.passMark}%</p>
        <div className="mt-4 flex gap-2"><Link className="btn-secondary" href={back}>{t("quiz.backToLesson")}</Link>{!attempt.passed && <Link className="btn-primary" href={retry}>{t("quiz.retry")}</Link>}</div>
      </div>
      <ol className="mt-8 space-y-4">
        {attempt.quiz.questions.map((q, i) => {
          const a = byQ.get(q.id);
          return (
            <li key={q.id} className="card p-5">
              <p className="font-medium" dir="auto"><span className={a?.isCorrect ? "text-success" : "text-error"}>{a?.isCorrect ? "✓" : "✗"}</span> {i + 1}. {pick(locale, q.promptEn, q.promptAr)}</p>
              <ul className="mt-3 space-y-1 text-sm">
                {q.options.map((o) => (
                  <li key={o.id} className={o.isCorrect ? "font-semibold text-success" : a?.optionIds.includes(o.id) ? "text-error" : "text-muted"}>
                    {o.isCorrect ? "✓ " : a?.optionIds.includes(o.id) ? "✗ " : "• "}<span dir="auto">{pick(locale, o.textEn, o.textAr)}</span>
                  </li>
                ))}
              </ul>
              {q.explanation && <p className="mt-2 text-sm text-muted">{q.explanation}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
