import Link from "next/link";
import { CheckCircle2, Lock, PlayCircle } from "lucide-react";
import type { PathStep } from "@/lib/paths";
import { categoryIcon } from "./icons";
import { categoryTheme } from "@/lib/category-theme";
import { pick, type Locale } from "@/i18n";

/** Vertical stepper of a learning path: done ✓, current (continue), locked 🔒. */
export function PathSteps({ steps, locale }: { steps: PathStep[]; locale: Locale }) {
  const ar = locale === "ar";
  return (
    <ol className="relative space-y-3">
      {steps.map((s, i) => {
        const th = categoryTheme(s.categorySlug);
        const Icon = categoryIcon(s.categorySlug);
        const body = (
          <div className={`card flex items-center gap-4 p-4 transition-colors ${s.current ? "border-2 shadow-lift" : ""} ${s.locked ? "opacity-60" : "hover:border-primary"}`} style={s.current ? { borderColor: th.accent } : undefined}>
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: s.locked ? "rgb(var(--muted))" : th.accent }}>
              <Icon size={22} aria-hidden />
              <span className="absolute -end-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-primary-dark text-[11px] font-bold">{i + 1}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{pick(locale, s.titleEn, s.titleAr)}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full" style={{ width: `${s.percent}%`, background: th.accent }} /></div>
                <span className="w-10 text-end text-xs text-muted">{s.percent}%</span>
              </div>
            </div>
            <div className="shrink-0 text-sm font-semibold">
              {s.done ? <span className="flex items-center gap-1 text-success"><CheckCircle2 size={18} aria-hidden />{ar ? "مكتمل" : "Done"}</span>
                : s.locked ? <span className="flex items-center gap-1 text-muted"><Lock size={16} aria-hidden />{ar ? "مقفول" : "Locked"}</span>
                : <span className="flex items-center gap-1" style={{ color: th.accent }}><PlayCircle size={18} aria-hidden />{s.percent ? (ar ? "أكمل" : "Continue") : (ar ? "ابدأ" : "Start")}</span>}
            </div>
          </div>
        );
        return <li key={s.courseId}>{s.locked ? <div aria-disabled="true">{body}</div> : <Link href={`/courses/${s.slug}`}>{body}</Link>}</li>;
      })}
    </ol>
  );
}
