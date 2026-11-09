import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminTitle, Table, Td } from "@/components/admin";
import { Badge } from "@/components/ui";
import { courseBranchMatrix, lessonStats, questionStats } from "@/lib/insights";

export const dynamic = "force-dynamic";

const heat = (rate: number) => rate >= 85 ? "bg-success/20 text-success" : rate >= 70 ? "bg-success/10" : rate >= 55 ? "bg-warning/20" : "bg-error/20 font-semibold text-error";

export default async function Insights({ searchParams }: { searchParams: Promise<{ course?: string; branch?: string; area?: string; audience?: string; days?: string }> }) {
  await requirePermission("reports.read");
  const sp = await searchParams;
  const f = { courseId: sp.course || undefined, branch: sp.branch || undefined, area: sp.area || undefined, audienceId: sp.audience || undefined, days: Number(sp.days) || undefined };
  const [courses, audiences, places, questions, lessons, matrix] = await Promise.all([
    db.course.findMany({ where: { deletedAt: null, status: "PUBLISHED" }, orderBy: { sortOrder: "asc" }, select: { id: true, titleEn: true, code: true } }),
    db.audience.findMany({ orderBy: { sortOrder: "asc" } }),
    db.user.findMany({ where: { deletedAt: null }, select: { branch: true, area: true }, distinct: ["branch", "area"] }),
    questionStats(f),
    lessonStats(f),
    courseBranchMatrix({ ...f, branch: undefined }),
  ]);
  const uniq = (xs: (string | null)[]) => [...new Set(xs.filter(Boolean) as string[])].sort();
  const branches = uniq(matrix.map((m) => m.branch)).filter((b) => !f.branch || b.toLowerCase() === f.branch.toLowerCase());
  const mCourses = [...new Map(matrix.map((m) => [m.courseId, m.courseTitle])).entries()];
  const cell = new Map(matrix.map((m) => [`${m.courseId}|${m.branch}`, m]));

  return (
    <>
      <AdminTitle title="Learning insights" />
      <p className="mb-4 max-w-3xl text-sm text-muted">Built from every answered quiz and exam question. Low correct-answer rates show where staff are genuinely unsure — use them to plan coaching, toolbox talks or to review the lesson content. The most-picked wrong answer shows the exact misconception.</p>
      <form method="get" className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <div><label className="label" htmlFor="course">Course</label><select id="course" name="course" defaultValue={sp.course ?? ""} className="input"><option value="">All courses</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.code ? `${c.code} — ` : ""}{c.titleEn}</option>)}</select></div>
        <div><label className="label" htmlFor="audience">Job role</label><select id="audience" name="audience" defaultValue={sp.audience ?? ""} className="input"><option value="">All</option>{audiences.map((a) => <option key={a.id} value={a.id}>{a.nameEn}</option>)}</select></div>
        <div><label className="label" htmlFor="area">Area</label><select id="area" name="area" defaultValue={sp.area ?? ""} className="input"><option value="">All</option>{uniq(places.map((p) => p.area)).map((a) => <option key={a}>{a}</option>)}</select></div>
        <div><label className="label" htmlFor="branch">Branch</label><select id="branch" name="branch" defaultValue={sp.branch ?? ""} className="input"><option value="">All</option>{uniq(places.map((p) => p.branch)).map((a) => <option key={a}>{a}</option>)}</select></div>
        <div><label className="label" htmlFor="days">Period</label><select id="days" name="days" defaultValue={sp.days ?? ""} className="input"><option value="">All time</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></div>
        <button className="btn-primary" type="submit">Apply</button>
      </form>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-primary-dark">Hardest questions</h2>
        {questions.length ? (
          <Table caption="Hardest questions" head={["Question", "Course / lesson", "Answered", "Correct", "Most-picked wrong answer"]}>
            {questions.slice(0, 25).map((q) => (
              <tr key={q.questionId}>
                <Td className="max-w-md"><span className="font-medium">{q.promptEn}</span>{q.promptAr && <span className="mt-0.5 block text-xs text-muted" dir="rtl">{q.promptAr}</span>}</Td>
                <Td className="text-xs">{q.courseTitle}<br /><span className="text-muted">{q.isFinal ? "Final exam" : q.lessonTitle}</span></Td>
                <Td>{q.served}</Td>
                <Td><span className={`rounded px-2 py-0.5 ${heat(q.rate)}`}>{q.rate}%</span></Td>
                <Td className="max-w-xs text-xs">{q.topWrong ? <>{q.topWrong.textEn} <Badge tone="error">{Math.round((q.topWrong.picks / q.served) * 100)}%</Badge></> : "—"}</Td>
              </tr>))}
          </Table>
        ) : <p className="card p-5 text-sm text-muted">Not enough answers yet for these filters (a question needs at least 5 answers).</p>}
      </section>

      <div className="grid gap-8">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-primary-dark">Lessons with the lowest quiz pass rate</h2>
          {lessons.length ? (
            <Table caption="Lessons" head={["Lesson", "Attempts", "Passed", "Avg score"]}>
              {lessons.map((l) => <tr key={l.lessonId}><Td><span className="font-medium">{l.lessonTitle}</span><span className="block text-xs text-muted">{l.courseTitle}</span></Td><Td>{l.attempts}</Td><Td><span className={`rounded px-2 py-0.5 ${heat(l.passRate)}`}>{l.passRate}%</span></Td><Td>{l.avgScore}%</Td></tr>)}
            </Table>
          ) : <p className="card p-5 text-sm text-muted">No data yet.</p>}
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-primary-dark">Correct answers by course and branch</h2>
          {mCourses.length && branches.length ? (
            <div className="card overflow-x-auto"><table className="w-full text-xs">
              <thead className="bg-background text-muted"><tr><th className="px-3 py-2 text-start">Course</th>{branches.map((b) => <th key={b} className="px-2 py-2 text-center font-semibold">{b}</th>)}</tr></thead>
              <tbody className="divide-y divide-border">{mCourses.map(([cid, title]) => (
                <tr key={cid}><td className="max-w-[220px] truncate px-3 py-2 font-medium" title={title}>{title}</td>
                  {branches.map((b) => { const c = cell.get(`${cid}|${b}`); return <td key={b} className="px-1 py-1 text-center">{c ? <span className={`block rounded px-1 py-1 ${heat(c.rate)}`} title={`${c.served} answers`}>{c.rate}%</span> : <span className="text-muted">·</span>}</td>; })}
                </tr>))}</tbody>
            </table></div>
          ) : <p className="card p-5 text-sm text-muted">No data yet.</p>}
          <p className="mt-2 text-xs text-muted">Green ≥ 85% · light green ≥ 70% · amber ≥ 55% · red below 55% correct.</p>
        </section>
      </div>
    </>
  );
}
