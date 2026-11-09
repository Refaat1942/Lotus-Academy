import Link from "next/link";
import { Route } from "lucide-react";
import { db } from "@/lib/db";
import { getT, pick } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { myPaths } from "@/lib/paths";
import { EmptyState, PageHeader, Progress } from "@/components/ui";
import { startPathAction } from "@/app/actions/engagement";

export const metadata = { title: "Learning paths" };
export const dynamic = "force-dynamic";

export default async function PathsPage() {
  const { locale } = await getT();
  const tx = (en: string, a: string) => (locale === "ar" ? a : en);
  const user = await requireUser();
  const mine = await myPaths(user.id);
  const me = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { audienceId: true } });
  const open = await db.learningPath.findMany({
    where: { published: true, id: { notIn: mine.map((m) => m.path.id) }, OR: [{ audienceId: null }, ...(me.audienceId ? [{ audienceId: me.audienceId }] : [])] },
    include: { _count: { select: { courses: true } }, audience: true },
  });

  return (
    <>
      <PageHeader eyebrow={tx("Step by step", "خطوة بخطوة")} title={tx("Learning paths", "المسارات التعليمية")} lead={tx("Programmes of courses in a set order — each course unlocks when you finish the one before it.", "برامج من الكورسات بترتيب محدد — يُفتح كل كورس بعد إنهاء الكورس الذي قبله.")} />
      <div className="mx-auto max-w-5xl space-y-10 px-4 py-10 sm:px-6">
        <section>
          <h2 className="mb-4 text-xl font-bold text-primary-dark">{tx("My paths", "مساراتي")}</h2>
          {mine.length ? (
            <div className="grid gap-4 md:grid-cols-2">{mine.map((p) => (
              <Link key={p.path.id} href={`/paths/${p.path.slug}`} className="card block p-5 hover:border-primary">
                <div className="flex items-start gap-3"><Route className="mt-0.5 shrink-0 text-primary" aria-hidden /><div className="min-w-0 flex-1">
                  <h3 className="font-bold">{pick(locale, p.path.titleEn, p.path.titleAr)}</h3>
                  <p className="text-sm text-muted">{p.steps.filter((s) => s.done).length}/{p.steps.length} {tx("courses", "كورسات")}{p.enrollment.dueAt ? ` · ${tx("Due", "الموعد")}: ${p.enrollment.dueAt.toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB")}` : ""}</p>
                  <div className="mt-3 flex items-center gap-2"><Progress value={p.percent} /><span className="text-sm font-semibold">{p.percent}%</span></div>
                </div></div>
              </Link>))}</div>
          ) : <EmptyState title={tx("No learning path assigned yet", "لم يُسند إليك مسار بعد")} description={tx("New team members get their onboarding path automatically. You can also start an open path below.", "يحصل الموظفون الجدد على مسار التأهيل تلقائيًا، ويمكنك أيضًا بدء أحد المسارات المتاحة بالأسفل.")} />}
        </section>
        {open.length > 0 && (
          <section>
            <h2 className="mb-4 text-xl font-bold text-primary-dark">{tx("Open to you", "متاحة لك")}</h2>
            <div className="grid gap-4 md:grid-cols-2">{open.map((p) => (
              <div key={p.id} className="card flex flex-col p-5">
                <h3 className="font-bold">{pick(locale, p.titleEn, p.titleAr)}</h3>
                <p className="mt-1 flex-1 text-sm text-muted">{pick(locale, p.descriptionEn, p.descriptionAr) || "—"}</p>
                <p className="mt-2 text-xs text-muted">{p._count.courses} {tx("courses", "كورسات")}{p.audience ? ` · ${pick(locale, p.audience.nameEn, p.audience.nameAr)}` : ""}</p>
                <form action={startPathAction} className="mt-3"><input type="hidden" name="pathId" value={p.id} /><button className="btn-primary" type="submit">{tx("Start this path", "ابدأ هذا المسار")}</button></form>
              </div>))}</div>
          </section>
        )}
      </div>
    </>
  );
}
