import Link from "next/link";
import { ArrowUpRight, BookOpen, Clock } from "lucide-react";
import { Badge, Progress, fmtDuration } from "./ui";
import { categoryIcon } from "./icons";
import type { CourseListItem } from "@/lib/catalog";
import { themeVars } from "@/lib/category-theme";
import { pick, type Locale, type MessageKey } from "@/i18n";

export function CourseCard({ c, locale, t, progress, index = 0 }: { c: CourseListItem; locale: Locale; t: (k: MessageKey) => string; progress?: { percent: number; status: string }; index?: number }) {
  const inst = c.instructors[0]?.instructor.user;
  const Icon = categoryIcon(c.category?.slug);
  return (
    <article style={{ ...themeVars(c.category?.slug), animationDelay: `${index * 70}ms` }} className="group card relative flex h-full animate-fade-up flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift">
      {/* Cover: brand gradient with the category icon (replace with an uploaded thumbnail later) */}
      <div className="relative flex h-40 items-end overflow-hidden p-4" style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-dark))" }}>
        <span className="pointer-events-none absolute -start-10 -top-10 h-36 w-36 rounded-full bg-white/10 transition-transform duration-500 group-hover:scale-150" aria-hidden />
        <span className="pointer-events-none absolute bottom-0 start-1/3 h-24 w-24 rounded-full bg-black/10" aria-hidden />
        {c.thumbnailUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={c.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <Icon size={120} strokeWidth={1.1} className="absolute -end-4 -top-4 text-white/20 transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110" aria-hidden />
        <div className="relative flex flex-wrap gap-2">
          {c.category && <span className="badge bg-white/95 text-primary-dark">{pick(locale, c.category.nameEn, c.category.nameAr)}</span>}
          <span className="badge bg-black/25 text-white backdrop-blur">{t(`level.${c.level}` as MessageKey)}</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-bold leading-snug text-text">
          <Link href={`/courses/${c.slug}`} className="after:absolute after:inset-0 group-hover:text-[var(--accent)]">{pick(locale, c.titleEn, c.titleAr)}</Link>
        </h3>
        <p dir="auto" className="mt-2 line-clamp-3 flex-1 text-sm leading-6 text-muted">{pick(locale, c.summaryEn, c.summaryAr)}</p>
        <p className="mt-3 text-xs font-medium text-muted">{inst ? `${inst.firstName} ${inst.lastName}` : t("courses.noInstructor")}</p>
        <div className="mt-3 flex items-center gap-4 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5"><BookOpen size={14} aria-hidden />{c._count.lessons} {t("common.lessons")}</span>
          <span className="inline-flex items-center gap-1.5"><Clock size={14} aria-hidden />{fmtDuration(c.durationMinutes, t)}</span>
        </div>
        <div className="mt-4 border-t border-border pt-4">
          {progress ? (
            <>
              <div className="mb-1.5 flex justify-between text-xs font-medium"><span>{progress.status === "COMPLETED" ? t("courses.completed") : t("courses.enrolled")}</span><span>{progress.percent}%</span></div>
              <Progress value={progress.percent} />
            </>
          ) : (
            <span className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: "var(--accent)" }}>{t("courses.enroll")} <ArrowUpRight size={16} aria-hidden className="rtl:-scale-x-100" /></span>
          )}
        </div>
      </div>
    </article>
  );
}
