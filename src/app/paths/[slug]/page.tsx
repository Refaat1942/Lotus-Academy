import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, Trophy } from "lucide-react";
import { getT, pick } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { myPaths } from "@/lib/paths";
import { PathSteps } from "@/components/PathSteps";
import { PageHeader, Progress } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PathPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ locked?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { locale } = await getT();
  const tx = (en: string, a: string) => (locale === "ar" ? a : en);
  const user = await requireUser();
  const p = (await myPaths(user.id)).find((x) => x.path.slug === slug);
  if (!p) notFound();
  const fmt = (d: Date) => d.toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB");
  const overdue = p.enrollment.dueAt && !p.enrollment.completedAt && p.enrollment.dueAt < new Date();

  return (
    <>
      <PageHeader eyebrow={tx("Learning path", "مسار تعليمي")} title={pick(locale, p.path.titleEn, p.path.titleAr)} lead={pick(locale, p.path.descriptionEn, p.path.descriptionAr) || undefined} />
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6">
        {sp.locked && <p role="status" className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">{tx("Finish the courses in order — the next one unlocks when you complete the current one.", "أكمل الكورسات بالترتيب — يُفتح الكورس التالي عند إنهاء الكورس الحالي.")}</p>}
        <div className="card flex flex-wrap items-center gap-6 p-5">
          <div className="min-w-[200px] flex-1"><div className="mb-1 flex justify-between text-sm font-semibold"><span>{tx("Overall progress", "التقدم الكلي")}</span><span>{p.percent}%</span></div><Progress value={p.percent} /></div>
          {p.enrollment.completedAt
            ? <span className="flex items-center gap-2 font-semibold text-success"><Trophy size={20} aria-hidden />{tx("Completed on", "اكتمل في")} {fmt(p.enrollment.completedAt)}</span>
            : p.enrollment.dueAt && <span className={`flex items-center gap-2 text-sm font-semibold ${overdue ? "text-error" : "text-muted"}`}><CalendarClock size={18} aria-hidden />{overdue ? tx("Overdue since", "متأخر منذ") : tx("Complete by", "أكمل قبل")} {fmt(p.enrollment.dueAt)}</span>}
        </div>
        <PathSteps steps={p.steps} locale={locale} />
        <Link href="/paths" className="inline-block text-sm text-primary hover:underline">← {tx("All learning paths", "كل المسارات")}</Link>
      </div>
    </>
  );
}
