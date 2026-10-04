import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getT } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { attemptsRemaining } from "@/lib/domain";
import { submitQuizAction } from "@/app/actions/learning";

export const dynamic = "force-dynamic";

export default async function QuizPage({ params }: { params: Promise<{ slug: string; lessonSlug: string }> }) {
  const { slug, lessonSlug } = await params;
  const { t } = await getT();
  const user = await requireUser();
  const lesson = await db.lesson.findFirst({ where: { slug: lessonSlug, course: { slug, status: "PUBLISHED" }, deletedAt: null } });
  if (!lesson) notFound();
  const enr = await db.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: lesson.courseId } } });
  if (!enr || enr.status === "CANCELLED") redirect(`/courses/${slug}`);
  const quiz = await db.quiz.findFirst({
    where: { lessonId: lesson.id, status: "PUBLISHED" },
    include: { questions: { orderBy: { position: "asc" }, include: { options: { orderBy: { position: "asc" }, select: { id: true, textEn: true } } } } },
  });
  const back = `/learn/${slug}/${lessonSlug}`;
  if (!quiz) return <div className="mx-auto max-w-2xl px-4 py-16"><p>{t("quiz.none")}</p><Link href={back} className="btn-secondary mt-4">{t("quiz.backToLesson")}</Link></div>;
  const history = await db.quizAttempt.findMany({ where: { userId: user.id, quizId: quiz.id, submittedAt: { not: null } }, orderBy: { startedAt: "desc" } });
  const left = attemptsRemaining(quiz.maxAttempts, history.length);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href={back} className="text-sm text-muted hover:text-primary">← {t("quiz.backToLesson")}</Link>
      <h1 className="mt-3 text-2xl font-semibold text-primary-dark">{quiz.titleEn}</h1>
      <p className="mt-1 text-sm text-muted">{t("quiz.passMark")}: {quiz.passMark}% · {left === null ? t("quiz.unlimited") : `${t("quiz.attemptsLeft")}: ${left}`}</p>
      {left === 0 ? <p role="alert" className="mt-6 rounded border border-warning/40 bg-warning/10 p-4 text-sm">{t("quiz.attemptsLeft")}: 0</p> : (
        <form action={submitQuizAction} className="mt-8 space-y-6">
          <input type="hidden" name="quizId" value={quiz.id} />
          {quiz.questions.map((q, i) => {
            const multi = q.type === "MULTIPLE_CHOICE";
            return (
              <fieldset key={q.id} className="card p-5">
                <legend className="px-1 font-medium"><span className="text-muted">{i + 1}. </span>{q.promptEn}</legend>
                <p className="mb-2 text-xs text-muted">{multi ? t("quiz.multi") : t("quiz.single")}</p>
                <div className="space-y-2">
                  {q.options.map((o) => (
                    <label key={o.id} className="flex cursor-pointer items-start gap-3 rounded border border-border p-3 text-sm hover:bg-primary-light has-[:checked]:border-primary has-[:checked]:bg-primary-light">
                      <input type={multi ? "checkbox" : "radio"} name={`q_${q.id}`} value={o.id} className="mt-1" />
                      <span>{o.textEn}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          })}
          <button className="btn-primary" type="submit">{t("quiz.submit")}</button>
        </form>
      )}
      {history.length > 0 && (
        <section className="mt-10"><h2 className="mb-3 font-semibold">{t("quiz.history")}</h2>
          <ul className="card divide-y divide-border text-sm">{history.map((h) => <li key={h.id} className="flex justify-between p-3"><span>{h.submittedAt?.toLocaleDateString()}</span><span>{h.scorePct}% — {h.passed ? t("quiz.passed") : t("quiz.failed")}</span></li>)}</ul></section>
      )}
    </div>
  );
}
