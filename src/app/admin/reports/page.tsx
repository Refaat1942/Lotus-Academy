import { requirePermission } from "@/lib/auth";
import { getT } from "@/i18n";
import { coursePerformance, dailySeries, overviewStats, parseRange } from "@/lib/reports";
import { AdminTitle, Table, Td } from "@/components/admin";
import { StatCard } from "@/components/ui";

export const metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

export default async function Reports({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requirePermission("reports.read");
  const sp = await searchParams;
  const { t } = await getT();
  const { from, to, key } = parseRange(sp);
  const [s, series, courses] = await Promise.all([overviewStats(from, to), dailySeries(from, to), coursePerformance()]);
  const q = key === "custom" ? `range=custom&from=${sp.from}&to=${sp.to}` : `range=${key}`;
  const max = Math.max(1, ...series.map((d) => Math.max(d.users, d.enrollments)));
  const ranges = [["today", "Today"], ["7d", "7 days"], ["30d", "30 days"], ["90d", "90 days"]];
  const exports = [["users", "users.read"], ["enrollments", "enrollments.read"], ["courses", "reports.read"], ["certificates", "certificates.read"], ["quizzes", "reports.read"], ["emails", "emails.read"]] as const;
  return (
    <>
      <AdminTitle title={t("admin.reports")} />
      <form method="get" className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <div className="flex gap-1" role="group" aria-label="Range">{ranges.map(([k, l]) => <button key={k} name="range" value={k} className={key === k ? "btn-primary" : "btn-secondary"}>{l}</button>)}</div>
        <div><label className="label" htmlFor="from">From</label><input id="from" name="from" type="date" defaultValue={sp.from} className="input" /></div>
        <div><label className="label" htmlFor="to">To</label><input id="to" name="to" type="date" defaultValue={sp.to} className="input" /></div>
        <button name="range" value="custom" className={key === "custom" ? "btn-primary" : "btn-secondary"}>Custom range</button>
      </form>

      <section aria-label="Key metrics" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="New registrations" value={s.users} /><StatCard label="Verified users" value={s.verified} /><StatCard label="Active learners" value={s.active} /><StatCard label="Enrollments" value={s.enrollments} />
        <StatCard label="Completions" value={s.completions} hint={`${s.completionRate}% of enrollments`} /><StatCard label="Lessons completed" value={s.lessonsDone} /><StatCard label="Avg. course progress" value={`${s.avgProgress}%`} /><StatCard label="Certificates issued" value={s.certIssued} />
        <StatCard label="Quiz attempts" value={s.quizTotal} /><StatCard label="Avg. quiz score" value={`${s.quizAvg}%`} /><StatCard label="Quiz pass rate" value={`${s.quizPassRate}%`} /><StatCard label="Certificate verifications (all time)" value={s.certVerified} />
        <StatCard label="Emails sent" value={s.emailSent} /><StatCard label="Emails failed" value={s.emailFailed} />
      </section>

      <section className="card mt-8 p-5"><h2 className="mb-1 font-semibold">Daily registrations & enrollments</h2>
        <p className="mb-4 text-xs text-muted">Teal: new users · Pink: enrollments</p>
        <div role="img" aria-label="Daily registrations and enrollments bar chart" className="flex h-40 items-end gap-px overflow-x-auto">
          {series.map((d) => (
            <div key={d.d} className="flex h-full min-w-[6px] flex-1 items-end gap-px" title={`${d.d}: ${d.users} users, ${d.enrollments} enrollments`}>
              <div className="w-1/2 rounded-t bg-primary" style={{ height: `${(d.users / max) * 100}%` }} />
              <div className="w-1/2 rounded-t bg-secondary" style={{ height: `${(d.enrollments / max) * 100}%` }} />
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8"><h2 className="mb-3 font-semibold">Course performance</h2>
        <Table caption="Course performance" head={["Code", "Course", "Enrollments", "Completions", "Avg. progress"]}>
          {courses.map((c) => <tr key={c.code + c.title}><Td className="font-mono text-xs">{c.code}</Td><Td>{c.title}</Td><Td>{c.enrollments}</Td><Td>{c.completions}</Td><Td>{c.avgProgress}%</Td></tr>)}
        </Table></section>

      <section className="mt-8"><h2 className="mb-3 font-semibold">{t("common.export")}</h2>
        <div className="flex flex-wrap gap-2">{exports.filter(([, p]) => me.permissions.has(p)).map(([k]) => <a key={k} className="btn-secondary" href={`/api/admin/export/${k}?${q}`}>{k}.csv</a>)}</div></section>
    </>
  );
}
