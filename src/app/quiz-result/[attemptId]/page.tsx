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
    where: { id: attemptId, userId: user.id, submittedAt: { not: null } }, // owner-only
    include: { quiz: { include: { lesson: { include: { course: true } }, questions: { include: { options: { orderBy: { position: "asc" } } } } } }, answers: true },
  });
  if (!attempt) notFound();
  const course = await db.course.findUniqueOrThrow({ where: { id: attempt.quiz.courseId }, select: { slug: true } });
  const lesson = attempt.quiz.lesson;
  const back = lesson ? `/learn/${course.slug}/${lesson.slug}` : `/courses/${course.slug}`;
  const retry = lesson ? `${back}/quiz` : `/learn/${course.slug}/final-exam`;
  const byQ = new Map(attempt.answers.map((a) => [a.questionId, a]));
  const qById = new Map(attempt.quiz.questions.map((q) => [q.id, q]));
  const served = (attempt.questionIds.length ? attempt.questionIds : attempt.quiz.questions.map((q) => q.id)).map((id) => qById.get(id)).filter((q): q is NonNullable<typeof q> => !!q);
  const reveal = attempt.passed; // correct answers are only revealed after passing
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className={`rounded-2xl border p-6 ${attempt.passed ? "border-success/30 bg-success/10" : "border-error/30 bg-error/10"}`} role="status">
        <h1 className="text-2xl font-extrabold">{attempt.passed ? t("quiz.passed") : t("quiz.failed")}</h1>
        <p className="mt-1 text-sm">{t("quiz.score")}: <strong>{attempt.scorePct}%</strong> · {t("quiz.passMark")}: {attempt.quiz.passMark}%</p>
        {!attempt.passed && <p className="mt-2 text-sm">{t("quiz.reviewHidden")}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className={attempt.passed ? "btn-primary" : "btn-secondary"} href={back}>{lesson ? t("quiz.backToLesson") : t("common.back")}</Link>
          {!attempt.passed && <Link className="btn-primary" href={retry}>{t("quiz.retry")}</Link>}
        </div>
      </div>
      <ol className="mt-8 space-y-4">
        {served.map((q, i) => {
          const a = byQ.get(q.id);
          return (
            <li key={q.id} className="card p-5">
              <p className="font-medium" dir="auto"><span className={a?.isCorrect ? "text-success" : "text-error"}>{a?.isCorrect ? "✓" : "✗"}</span> {i + 1}. {pick(locale, q.promptEn, q.promptAr)}</p>
              <ul className="mt-3 space-y-1 text-sm">
                {q.options.map((o) => {
                  const chosen = !!a?.optionIds.includes(o.id);
                  if (!reveal && !chosen) return null; // before passing, only show what the learner chose
                  return (
                    <li key={o.id} dir="auto" className={reveal && o.isCorrect ? "font-semibold text-success" : chosen ? (a?.isCorrect ? "text-success" : "text-error") : "text-muted"}>
                      {reveal && o.isCorrect ? "✓ " : chosen ? `${t("quiz.yourAnswer")}: ` : "• "}{pick(locale, o.textEn, o.textAr)}
                    </li>
                  );
                })}
                {!a?.optionIds.length && <li className="text-muted">—</li>}
              </ul>
              {reveal && q.explanation && <p className="mt-2 text-sm text-muted">{q.explanation}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
