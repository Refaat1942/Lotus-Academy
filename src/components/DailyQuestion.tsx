import Link from "next/link";
import { CheckCircle2, Flame, Lightbulb, XCircle } from "lucide-react";
import type { DailyView } from "@/lib/engagement";
import { POINTS } from "@/lib/engagement";
import { pick, type Locale } from "@/i18n";
import { answerDailyAction } from "@/app/actions/engagement";

/** "Question of the day" card for the dashboard (spaced review; answers revealed after answering). */
export function DailyQuestion({ d, locale }: { d: DailyView | null; locale: Locale }) {
  const ar = locale === "ar";
  const tx = (en: string, a: string) => (ar ? a : en);
  return (
    <section aria-labelledby="daily-q" className="card relative overflow-hidden p-5">
      <div aria-hidden className="pointer-events-none absolute -end-10 -top-10 h-32 w-32 rounded-full bg-amber-300/20 blur-2xl" />
      <div className="flex items-center justify-between gap-3">
        <h2 id="daily-q" className="flex items-center gap-2 text-lg font-extrabold text-primary-dark"><Lightbulb className="text-amber-500" aria-hidden />{tx("Question of the day", "سؤال اليوم")}</h2>
        {d && <span className="flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-600" title={tx("Days in a row", "أيام متتالية")}><Flame size={14} aria-hidden />{d.streak}</span>}
      </div>
      {!d ? (
        <p className="mt-3 text-sm text-muted">{tx("Complete your first lesson to unlock a daily review question from what you've learned.", "أكمل أول درس ليظهر لك سؤال مراجعة يومي مما تعلّمته.")}</p>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted">{pick(locale, d.courseTitle, d.courseTitleAr)} · +{POINTS.dailyCorrect + POINTS.dailyAnswered} {tx("points if correct", "نقاط للإجابة الصحيحة")}</p>
          <p className="mt-3 font-semibold" dir={ar && d.promptAr ? "rtl" : undefined}>{pick(locale, d.promptEn, d.promptAr)}</p>
          {d.answered ? (
            <ul className="mt-3 space-y-2 text-sm">
              {d.options.map((o) => {
                const right = o.id === d.correctId, chosen = o.id === d.chosenId;
                return <li key={o.id} className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${right ? "border-success/50 bg-success/10" : chosen ? "border-error/40 bg-error/10" : "border-border opacity-70"}`}>
                  {right ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" aria-hidden /> : chosen ? <XCircle size={16} className="mt-0.5 shrink-0 text-error" aria-hidden /> : <span className="w-4" />}{pick(locale, o.textEn, o.textAr)}</li>;
              })}
              <li className={`pt-1 text-sm font-semibold ${d.correct ? "text-success" : "text-error"}`}>{d.correct ? tx("Correct — well done! Come back tomorrow for a new question.", "إجابة صحيحة — أحسنت! عُد غدًا لسؤال جديد.") : tx("Not quite — the correct answer is highlighted. Review it and try again tomorrow.", "ليست صحيحة — الإجابة الصحيحة مظللة. راجعها وعد غدًا.")} <Link href="/leaderboard" className="ms-1 underline">{tx("Leaderboard", "لوحة الصدارة")}</Link></li>
            </ul>
          ) : (
            <form action={answerDailyAction} className="mt-3 space-y-2">
              {d.options.map((o) => (
                <label key={o.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:border-primary has-[:checked]:border-primary has-[:checked]:bg-primary-light/50">
                  <input type="radio" name="optionId" value={o.id} required className="mt-1" />{pick(locale, o.textEn, o.textAr)}
                </label>))}
              <button type="submit" className="btn-primary">{tx("Answer", "أجب")}</button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
