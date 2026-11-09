import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BellRing } from "lucide-react";
import { db } from "@/lib/db";
import { getT, pick } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { inScope, managerScope, memberCourses } from "@/lib/team";
import { certState } from "@/lib/learning";
import { myPaths } from "@/lib/paths";
import { leaderboard } from "@/lib/engagement";
import { Badge, PageHeader, Progress, StatCard } from "@/components/ui";
import { nudgeAction } from "@/app/actions/engagement";

export const dynamic = "force-dynamic";

export default async function MemberPage({ params, searchParams }: { params: Promise<{ userId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { userId } = await params;
  const sp = await searchParams;
  const { locale } = await getT();
  const ar = locale === "ar";
  const tx = (en: string, a: string) => (ar ? a : en);
  const user = await requireUser();
  const scope = await managerScope(user, sp);
  if (!scope) redirect("/team");
  if (!(await inScope(scope, userId, user.id))) notFound();

  const m = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { audience: true } });
  const [courses, certs, paths, score, attempts] = await Promise.all([
    memberCourses(userId),
    db.certificate.findMany({ where: { userId }, orderBy: { issuedAt: "desc" } }),
    myPaths(userId),
    leaderboard({ id: userId }),
    db.quizAttempt.findMany({ where: { userId, submittedAt: { not: null } }, orderBy: { submittedAt: "desc" }, take: 8, include: { quiz: { select: { titleEn: true, titleAr: true, lessonId: true } } } }),
  ]);
  const status = { COMPLETED: [tx("Completed", "مكتمل"), "success"], IN_PROGRESS: [tx("In progress", "قيد التنفيذ"), "primary"], NOT_STARTED: [tx("Not started", "لم يبدأ"), "neutral"], OVERDUE: [tx("Overdue", "متأخر"), "error"] } as const;
  const fmt = (d: Date) => d.toLocaleDateString(ar ? "ar-EG" : "en-GB");
  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && ["branch", "area", "department"].includes(k)) as [string, string][]).toString();

  return (
    <>
      <PageHeader eyebrow={[pick(locale, m.audience?.nameEn, m.audience?.nameAr), m.branch, m.area].filter(Boolean).join(" · ")} title={`${m.firstName} ${m.lastName}`} lead={m.email} />
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/team${qs ? `?${qs}` : ""}`} className="text-sm text-primary hover:underline">← {tx("Back to my team", "العودة إلى فريقي")}</Link>
          <form action={nudgeAction}><input type="hidden" name="back" value={`/team${qs ? `?${qs}` : ""}`} /><input type="hidden" name="userId" value={m.id} /><button type="submit" className="btn-primary"><BellRing size={16} aria-hidden />{tx("Send a reminder", "أرسل تذكيرًا")}</button></form>
        </div>
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label={tx("Courses", "الكورسات")} value={courses.length} />
          <StatCard label={tx("Completed", "المكتملة")} value={courses.filter((c) => c.status === "COMPLETED").length} />
          <StatCard label={tx("Overdue", "المتأخرة")} value={<span className={courses.some((c) => c.status === "OVERDUE") ? "text-error" : ""}>{courses.filter((c) => c.status === "OVERDUE").length}</span>} />
          <StatCard label={tx("Points", "النقاط")} value={score[0]?.points ?? 0} hint={m.lastLoginAt ? `${tx("Last sign-in", "آخر دخول")}: ${fmt(m.lastLoginAt)}` : tx("Has not signed in yet", "لم يسجّل الدخول بعد")} />
        </section>

        <section className="card overflow-hidden">
          <h2 className="border-b border-border px-5 py-4 text-lg font-bold text-primary-dark">{tx("Courses", "الكورسات")}</h2>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-background text-xs uppercase text-muted"><tr>{[tx("Course", "الكورس"), tx("Type", "النوع"), tx("Progress", "التقدم"), tx("Status", "الحالة"), tx("Due", "الموعد"), tx("Completed", "تاريخ الإنهاء")].map((h) => <th key={h} className="px-4 py-2 text-start">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">{courses.map((c) => (
              <tr key={c.courseId}>
                <td className="px-4 py-2 font-medium">{pick(locale, c.title, c.titleAr)}</td>
                <td className="px-4 py-2 text-xs">{c.source === "assigned" ? <Badge tone="warning">{tx("Mandatory", "إلزامي")}</Badge> : tx("Optional", "اختياري")}</td>
                <td className="px-4 py-2"><div className="flex min-w-[130px] items-center gap-2"><Progress value={c.percent} /><span className="w-9 text-end text-xs">{c.percent}%</span></div></td>
                <td className="px-4 py-2"><Badge tone={status[c.status][1]}>{status[c.status][0]}</Badge></td>
                <td className="px-4 py-2 text-xs">{c.dueAt ? fmt(c.dueAt) : "—"}</td>
                <td className="px-4 py-2 text-xs">{c.completedAt && c.status === "COMPLETED" ? fmt(c.completedAt) : "—"}</td>
              </tr>))}</tbody>
          </table></div>
        </section>

        <div className="grid gap-8 lg:grid-cols-3">
          <section className="card p-5"><h2 className="mb-3 font-bold text-primary-dark">{tx("Learning paths", "المسارات التعليمية")}</h2>
            {paths.length ? paths.map((p) => <div key={p.path.id} className="mb-3"><div className="flex justify-between text-sm font-semibold"><span>{pick(locale, p.path.titleEn, p.path.titleAr)}</span><span>{p.percent}%</span></div><Progress value={p.percent} /></div>) : <p className="text-sm text-muted">—</p>}
          </section>
          <section className="card p-5"><h2 className="mb-3 font-bold text-primary-dark">{tx("Certificates", "الشهادات")}</h2>
            {certs.length ? <ul className="space-y-2 text-sm">{certs.map((c) => { const s = certState(c); return <li key={c.id} className="flex justify-between gap-2"><span className="truncate">{c.courseTitle}</span><Badge tone={s === "valid" ? "success" : s === "expiring" ? "warning" : "error"}>{{ valid: tx("Valid", "سارية"), expiring: tx("Expiring", "تنتهي قريبًا"), expired: tx("Expired", "منتهية"), revoked: tx("Revoked", "ملغاة") }[s]}</Badge></li>; })}</ul> : <p className="text-sm text-muted">—</p>}
          </section>
          <section className="card p-5"><h2 className="mb-3 font-bold text-primary-dark">{tx("Recent quiz results", "آخر نتائج الاختبارات")}</h2>
            {attempts.length ? <ul className="space-y-2 text-sm">{attempts.map((a) => <li key={a.id} className="flex justify-between gap-2"><span className="truncate">{pick(locale, a.quiz.titleEn, a.quiz.titleAr)}</span><span className={a.passed ? "text-success" : "text-error"}>{a.scorePct}%</span></li>)}</ul> : <p className="text-sm text-muted">—</p>}
          </section>
        </div>
      </div>
    </>
  );
}
