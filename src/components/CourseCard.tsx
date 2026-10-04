import Link from "next/link";
import { BookOpen, Clock } from "lucide-react";
import { Badge, Progress, fmtDuration } from "./ui";
import type { CourseListItem } from "@/lib/catalog";
import { pick, type Locale, type MessageKey } from "@/i18n";

export function CourseCard({ c, locale, t, progress }: { c: CourseListItem; locale: Locale; t: (k: MessageKey) => string; progress?: { percent: number; status: string } }) {
  const inst = c.instructors[0]?.instructor.user;
  return (
    <article className="card relative flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md">
      <div className="h-2 bg-gradient-to-r from-primary to-primary-light" aria-hidden />
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {c.category && <Badge tone="primary">{pick(locale, c.category.nameEn, c.category.nameAr)}</Badge>}
          <Badge>{t(`level.${c.level}` as MessageKey)}</Badge>
        </div>
        <h3 className="text-lg font-semibold leading-snug text-text">
          <Link href={`/courses/${c.slug}`} className="after:absolute hover:text-primary">{pick(locale, c.titleEn, c.titleAr)}</Link>
        </h3>
        <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted">{pick(locale, c.summaryEn, c.summaryAr)}</p>
        <p className="mt-3 text-xs text-muted">{inst ? `${inst.firstName} ${inst.lastName}` : t("courses.noInstructor")}</p>
        <div className="mt-3 flex items-center gap-4 text-xs text-muted">
          <span className="inline-flex items-center gap-1"><BookOpen size={14} aria-hidden />{c._count.lessons} {t("common.lessons")}</span>
          <span className="inline-flex items-center gap-1"><Clock size={14} aria-hidden />{fmtDuration(c.durationMinutes, t)}</span>
        </div>
        <div className="mt-4">
          {progress ? (
            <>
              <div className="mb-1 flex justify-between text-xs"><span>{progress.status === "COMPLETED" ? t("courses.completed") : t("courses.enrolled")}</span><span>{progress.percent}%</span></div>
              <Progress value={progress.percent} />
            </>
          ) : (
            <span className="text-sm font-semibold text-primary">{t("courses.enroll")} →</span>
          )}
        </div>
      </div>
    </article>
  );
}
