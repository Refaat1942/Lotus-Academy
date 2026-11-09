import Link from "next/link";
import { AlertTriangle, BellRing, CheckCircle2, Users } from "lucide-react";
import { db } from "@/lib/db";
import { getT } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { byBranch, managerScope, teamKpis, teamMembers } from "@/lib/team";
import { Badge, EmptyState, PageHeader, Progress, StatCard } from "@/components/ui";
import { nudgeAction } from "@/app/actions/engagement";

export const metadata = { title: "My team" };
export const dynamic = "force-dynamic";

type SP = { branch?: string; area?: string; department?: string; status?: string; q?: string; nudged?: string };

export default async function TeamPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { locale } = await getT();
  const ar = locale === "ar";
  const tx = (en: string, a: string) => (ar ? a : en);
  const user = await requireUser();
  const scope = await managerScope(user, sp);

  if (!scope) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <EmptyState title={tx("My team is for managers", "صفحة فريقي مخصّصة للمديرين")}
          description={tx("Branch, area and department managers see their team's training here. Ask your training administrator to set your job role and branch/area/department on your profile.",
            "يرى مديرو الفروع والمناطق والإدارات تدريب فريقهم هنا. اطلب من مسؤول التدريب ضبط وظيفتك والفرع/المنطقة/الإدارة في ملفك.")}
          action={{ href: "/dashboard", label: tx("Back to my learning", "العودة إلى تعلّمي") }} />
      </div>
    );
  }

  const all = await teamMembers(scope, user.id);
  const q = (sp.q ?? "").trim().toLowerCase();
  const rows = all.filter((r) => (sp.status !== "overdue" || r.overdue > 0) && (!q || r.name.toLowerCase().includes(q) || r.email.includes(q)));
  const k = teamKpis(all);
  const branches = scope.kind !== "branch" ? byBranch(all) : [];
  const overdueIds = all.filter((r) => r.overdue > 0).map((r) => r.id);
  const scopeLabel = scope.kind === "all" ? tx("Whole company", "الشركة بالكامل")
    : `${{ branch: tx("Branch", "فرع"), area: tx("Area", "منطقة"), department: tx("Department", "إدارة") }[scope.kind]}: ${scope.value}`;
  const filters = scope.admin ? await db.user.findMany({ where: { deletedAt: null, OR: [{ branch: { not: null } }, { area: { not: null } }] }, select: { branch: true, area: true, department: true }, distinct: ["branch", "area", "department"] }) : [];
  const uniq = (xs: (string | null)[]) => [...new Set(xs.filter(Boolean) as string[])].sort();
  const keep = new URLSearchParams(Object.entries({ branch: sp.branch, area: sp.area, department: sp.department }).filter(([, v]) => v) as [string, string][]).toString();
  const back = `/team${keep ? `?${keep}` : ""}`;

  return (
    <>
      <PageHeader eyebrow={scopeLabel} title={tx("My team's training", "تدريب فريقي")} lead={tx("Who is on track, who is overdue, and where to help — updated live from the academy.", "من يسير على الخطة ومن تأخّر وأين يحتاج الفريق للدعم — بيانات مباشرة من الأكاديمية.")} />
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
        {sp.nudged && <p role="status" className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">{tx(`Reminder sent to ${sp.nudged} member(s). (Each person can be reminded once a day.)`, `تم إرسال تذكير إلى ${sp.nudged} من أعضاء الفريق. (يمكن تذكير كل شخص مرة واحدة يوميًا.)`)}</p>}

        {scope.admin && (
          <form className="card flex flex-wrap items-end gap-3 p-4" method="get">
            <div><label className="label" htmlFor="area">{tx("Area", "المنطقة")}</label><select id="area" name="area" defaultValue={sp.area ?? ""} className="input"><option value="">{tx("All", "الكل")}</option>{uniq(filters.map((f) => f.area)).map((a) => <option key={a}>{a}</option>)}</select></div>
            <div><label className="label" htmlFor="branch">{tx("Branch", "الفرع")}</label><select id="branch" name="branch" defaultValue={sp.branch ?? ""} className="input"><option value="">{tx("All", "الكل")}</option>{uniq(filters.map((f) => f.branch)).map((a) => <option key={a}>{a}</option>)}</select></div>
            <div><label className="label" htmlFor="department">{tx("Department", "الإدارة")}</label><select id="department" name="department" defaultValue={sp.department ?? ""} className="input"><option value="">{tx("All", "الكل")}</option>{uniq(filters.map((f) => f.department)).map((a) => <option key={a}>{a}</option>)}</select></div>
            <button className="btn-primary" type="submit">{tx("Show", "عرض")}</button>
          </form>
        )}

        <section aria-label={tx("Summary", "ملخص")} className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard label={tx("Team members", "أعضاء الفريق")} value={k.members} />
          <StatCard label={tx("Mandatory training done", "إنجاز التدريب الإلزامي")} value={`${k.compliance}%`} />
          <StatCard label={tx("Overdue courses", "كورسات متأخرة")} value={<span className={k.overdue ? "text-error" : ""}>{k.overdue}</span>} hint={tx(`${k.overdueMembers} people`, `${k.overdueMembers} أشخاص`)} />
          <StatCard label={tx("Active this week", "نشطون هذا الأسبوع")} value={`${k.activeWeek}/${k.members}`} />
          <StatCard label={tx("Certificates earned", "شهادات مكتسبة")} value={k.certificates} />
        </section>

        {branches.length > 1 && (
          <section className="card overflow-hidden">
            <h2 className="border-b border-border px-5 py-4 text-lg font-bold text-primary-dark">{tx("Branches — lowest compliance first", "الفروع — الأقل التزامًا أولًا")}</h2>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="bg-background text-start text-xs uppercase text-muted"><tr>{[tx("Branch", "الفرع"), tx("Area", "المنطقة"), tx("Members", "الأعضاء"), tx("Mandatory done", "الإلزامي المنجز"), tx("Overdue", "متأخر"), tx("Active (7 days)", "نشط (7 أيام)")].map((h) => <th key={h} className="px-4 py-2 text-start">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-border">{branches.map((b) => (
                <tr key={b.branch}>
                  <td className="px-4 py-2 font-semibold">{scope.admin ? <Link className="hover:text-primary" href={`/team?branch=${encodeURIComponent(b.branch)}`}>{b.branch}</Link> : b.branch}</td>
                  <td className="px-4 py-2 text-muted">{b.area ?? "—"}</td>
                  <td className="px-4 py-2">{b.members}</td>
                  <td className="px-4 py-2"><div className="flex min-w-[140px] items-center gap-2"><Progress value={b.compliance} /><span className="w-10 text-end font-semibold">{b.compliance}%</span></div></td>
                  <td className="px-4 py-2">{b.overdue ? <Badge tone="error">{b.overdue}</Badge> : <Badge tone="success">0</Badge>}</td>
                  <td className="px-4 py-2">{b.activeWeek}/{b.members}</td>
                </tr>))}</tbody>
            </table></div>
          </section>
        )}

        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <h2 className="flex items-center gap-2 text-lg font-bold text-primary-dark"><Users size={20} aria-hidden />{tx("Team members", "أعضاء الفريق")}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <form method="get" className="flex gap-2">
                {Object.entries({ branch: sp.branch, area: sp.area, department: sp.department }).map(([k2, v]) => v ? <input key={k2} type="hidden" name={k2} value={v} /> : null)}
                <input name="q" defaultValue={sp.q} placeholder={tx("Search name or email", "ابحث بالاسم أو البريد")} className="input !py-1.5" aria-label={tx("Search", "بحث")} />
                <select name="status" defaultValue={sp.status ?? ""} className="input !w-auto !py-1.5" aria-label={tx("Status", "الحالة")}><option value="">{tx("Everyone", "الكل")}</option><option value="overdue">{tx("Overdue only", "المتأخرون فقط")}</option></select>
                <button className="btn-secondary !py-1.5" type="submit">{tx("Filter", "تصفية")}</button>
              </form>
              {overdueIds.length > 0 && (
                <form action={nudgeAction}>
                  <input type="hidden" name="back" value={back} />
                  {overdueIds.map((id) => <input key={id} type="hidden" name="userId" value={id} />)}
                  <button className="btn-primary !py-1.5" type="submit"><BellRing size={16} aria-hidden />{tx(`Remind all overdue (${overdueIds.length})`, `ذكّر كل المتأخرين (${overdueIds.length})`)}</button>
                </form>
              )}
            </div>
          </div>
          {rows.length ? (
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="bg-background text-xs uppercase text-muted"><tr>{[tx("Name", "الاسم"), tx("Job role", "الوظيفة"), tx("Branch", "الفرع"), tx("Mandatory", "الإلزامي"), tx("Status", "الحالة"), tx("Avg. progress", "متوسط التقدم"), tx("Certificates", "الشهادات"), tx("Last active", "آخر نشاط"), ""].map((h, i) => <th key={i} className="px-4 py-2 text-start">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-border">{rows.map((r) => (
                <tr key={r.id} className={r.overdue ? "bg-error/[0.03]" : ""}>
                  <td className="px-4 py-2"><Link href={`/team/${r.id}${keep ? `?${keep}` : ""}`} className="font-semibold hover:text-primary">{r.name}</Link><div className="text-xs text-muted">{r.email}</div></td>
                  <td className="px-4 py-2">{ar ? r.roleAr ?? r.role ?? "—" : r.role ?? "—"}</td>
                  <td className="px-4 py-2">{r.branch ?? "—"}</td>
                  <td className="px-4 py-2 font-semibold">{r.requiredDone}/{r.required}</td>
                  <td className="px-4 py-2">{r.overdue ? <Badge tone="error"><AlertTriangle size={12} className="me-1 inline" aria-hidden />{tx(`${r.overdue} overdue`, `${r.overdue} متأخر`)}</Badge>
                    : r.required && r.requiredDone === r.required ? <Badge tone="success"><CheckCircle2 size={12} className="me-1 inline" aria-hidden />{tx("Up to date", "ملتزم")}</Badge>
                    : <Badge tone="primary">{tx("On track", "في الموعد")}</Badge>}</td>
                  <td className="px-4 py-2"><div className="flex min-w-[120px] items-center gap-2"><Progress value={r.avgPercent} /><span className="w-9 text-end text-xs">{r.avgPercent}%</span></div></td>
                  <td className="px-4 py-2">{r.certificates}</td>
                  <td className="px-4 py-2 text-xs text-muted">{r.lastActive ? r.lastActive.toLocaleDateString(ar ? "ar-EG" : "en-GB") : tx("Never", "لم يدخل")}</td>
                  <td className="px-4 py-2">
                    <form action={nudgeAction}><input type="hidden" name="back" value={back} /><input type="hidden" name="userId" value={r.id} />
                      <button type="submit" className="btn-secondary !px-2.5 !py-1 text-xs" title={tx("Send a reminder", "أرسل تذكيرًا")}><BellRing size={14} aria-hidden /><span className="sr-only">{tx("Send a reminder", "أرسل تذكيرًا")}</span></button></form>
                  </td>
                </tr>))}</tbody>
            </table></div>
          ) : <p className="p-6 text-sm text-muted">{tx("No team members match.", "لا يوجد أعضاء مطابقون.")}</p>}
        </section>
      </div>
    </>
  );
}
