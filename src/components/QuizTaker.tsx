import Link from "next/link";
import { getT, pick } from "@/i18n";
import { submitQuizAction } from "@/app/actions/learning";
import type { AttemptView } from "@/lib/learning";

/** Shared quiz / final-exam form for one served attempt. Answers are never sent to the browser. */
export async function QuizTaker({ title, passMark, view, backHref, backLabel, history }: {
  title: string; passMark: number; view: AttemptView | null; backHref: string; backLabel: string;
  history: { id: string; submittedAt: Date | null; scorePct: number; passed: boolean }[];
}) {
  const { t, locale } = await getT();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href={backHref} className="text-sm text-muted hover:text-primary">← {backLabel}</Link>
      <h1 className="mt-3 text-2xl font-extrabold text-primary-dark">{title}</h1>
      {view && <p className="mt-1 text-sm text-muted">{view.questions.length} · {t("quiz.passMark")}: {passMark}% · {view.remaining === null ? t("quiz.unlimited") : `${t("quiz.attemptsLeft")}: ${view.remaining}`}</p>}
      {view && <p className="mt-1 text-xs text-muted">{t("quiz.newQuestions")}</p>}
      {!view ? <p role="alert" className="mt-6 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">{t("quiz.noAttempts")}</p> : (
        <form action={submitQuizAction} className="mt-8 space-y-6">
          <input type="hidden" name="attemptId" value={view.attemptId} />
          {view.questions.map((q, i) => {
            const multi = q.type === "MULTIPLE_CHOICE";
            return (
              <fieldset key={q.id} className="card p-5">
                <legend className="px-1 font-semibold" dir="auto"><span className="text-muted">{i + 1}. </span>{pick(locale, q.promptEn, q.promptAr)}</legend>
                <p className="mb-2 text-xs text-muted">{multi ? t("quiz.multi") : t("quiz.single")}</p>
                <div className="space-y-2">
                  {q.options.map((o) => (
                    <label key={o.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-sm transition-colors hover:bg-primary-light has-[:checked]:border-primary has-[:checked]:bg-primary-light">
                      <input type={multi ? "checkbox" : "radio"} name={`q_${q.id}`} value={o.id} required={!multi} className="mt-1" />
                      <span dir="auto">{pick(locale, o.textEn, o.textAr)}</span>
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
