import Link from "next/link";
import { Crown, Flame, Medal, Trophy } from "lucide-react";
import { db } from "@/lib/db";
import { getT } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { POINTS, branchBoard, leaderboard, streakOf } from "@/lib/engagement";
import { PageHeader, StatCard } from "@/components/ui";

export const metadata = { title: "Leaderboard" };
export const dynamic = "force-dynamic";

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ scope?: string; period?: string }> }) {
  const sp = await searchParams;
  const { locale } = await getT();
  const ar = locale === "ar";
  const tx = (en: string, a: string) => (ar ? a : en);
  const user = await requireUser();
  const me = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { branch: true, area: true } });
  const scope = sp.scope === "branch" && me.branch ? "branch" : sp.scope === "area" && me.area ? "area" : "all";
  const period = sp.period === "month" ? "month" : "all";
  const since = period === "month" ? new Date(new Date().getFullYear(), new Date().getMonth(), 1) : undefined;
  const everyone = await leaderboard({}, since);
  const rows = everyone.filter((r) => scope === "all" || (scope === "branch" ? r.branch?.toLowerCase() === me.branch?.toLowerCase() : r.area?.toLowerCase() === me.area?.toLowerCase()));
  const myRank = rows.findIndex((r) => r.userId === user.id);
  const mine = rows[myRank];
  const branches = branchBoard(everyone).slice(0, 10);
  const streak = await streakOf(user.id);
  const link = (o: Record<string, string>) => `/leaderboard?${new URLSearchParams({ scope, period, ...o })}`;
  const tab = (active: boolean) => `rounded-lg px-3 py-1.5 text-sm font-semibold ${active ? "bg-primary text-white" : "hover:bg-primary-light"}`;
  const medal = (i: number) => i === 0 ? <Crown size={18} className="text-amber-500" aria-label="1" /> : i === 1 ? <Medal size={18} className="text-slate-400" aria-label="2" /> : i === 2 ? <Medal size={18} className="text-amber-700" aria-label="3" /> : <span className="w-[18px] text-center text-sm text-muted">{i + 1}</span>;

  return (
    <>
      <PageHeader eyebrow={tx("Learn, earn points, lead your branch", "تعلّم، اجمع النقاط، وارفع فرعك")} title={tx("Leaderboard", "لوحة الصدارة")} />
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label={tx("My points", "نقاطي")} value={mine?.points ?? 0} />
          <StatCard label={tx("My rank", "ترتيبي")} value={myRank >= 0 ? `#${myRank + 1}` : "—"} hint={tx(`of ${rows.length}`, `من ${rows.length}`)} />
          <StatCard label={tx("Daily-question streak", "سلسلة سؤال اليوم")} value={<span className="flex items-center gap-1"><Flame className="text-orange-500" aria-hidden />{streak}</span>} hint={tx("days in a row", "أيام متتالية")} />
          <StatCard label={tx("Certificates", "الشهادات")} value={mine?.certificates ?? 0} />
        </section>

        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label={tx("Scope", "النطاق")} className="flex gap-1 rounded-xl border border-border bg-surface p-1">
            <Link className={tab(scope === "all")} href={link({ scope: "all" })}>{tx("Company", "الشركة")}</Link>
            {me.area && <Link className={tab(scope === "area")} href={link({ scope: "area" })}>{tx("My area", "منطقتي")}</Link>}
            {me.branch && <Link className={tab(scope === "branch")} href={link({ scope: "branch" })}>{tx("My branch", "فرعي")}</Link>}
          </nav>
          <nav aria-label={tx("Period", "الفترة")} className="flex gap-1 rounded-xl border border-border bg-surface p-1">
            <Link className={tab(period === "all")} href={link({ period: "all" })}>{tx("All time", "كل الوقت")}</Link>
            <Link className={tab(period === "month")} href={link({ period: "month" })}>{tx("This month", "هذا الشهر")}</Link>
          </nav>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          <section className="card overflow-hidden">
            <h2 className="flex items-center gap-2 border-b border-border px-5 py-4 text-lg font-bold text-primary-dark"><Trophy size={20} aria-hidden />{tx("Top learners", "أفضل المتعلمين")}</h2>
            <ol className="divide-y divide-border">
              {rows.slice(0, 25).map((r, i) => (
                <li key={r.userId} className={`flex items-center gap-3 px-5 py-3 text-sm ${r.userId === user.id ? "bg-primary-light/60 font-semibold" : ""}`}>
                  {medal(i)}
                  <span className="min-w-0 flex-1"><span className="block truncate">{r.name}{r.userId === user.id ? ` (${tx("you", "أنت")})` : ""}</span><span className="block text-xs text-muted">{[r.branch, r.role].filter(Boolean).join(" · ")}</span></span>
                  <span className="hidden text-xs text-muted sm:inline">{r.lessons} {tx("lessons", "درس")} · {r.certificates} {tx("cert.", "شهادة")}</span>
                  <span className="w-16 text-end font-bold text-primary-dark">{r.points}</span>
                </li>))}
              {myRank >= 25 && mine && <li className="flex items-center gap-3 bg-primary-light/60 px-5 py-3 text-sm font-semibold"><span className="w-[18px] text-center">{myRank + 1}</span><span className="flex-1">{mine.name} ({tx("you", "أنت")})</span><span className="w-16 text-end">{mine.points}</span></li>}
            </ol>
          </section>
          <aside className="space-y-6">
            <section className="card overflow-hidden">
              <h2 className="border-b border-border px-5 py-4 font-bold text-primary-dark">{tx("Top branches", "أفضل الفروع")}</h2>
              <p className="px-5 pt-3 text-xs text-muted">{tx("Average points per team member", "متوسط النقاط لكل عضو في الفريق")}</p>
              <ol className="divide-y divide-border">{branches.map((b, i) => (
                <li key={b.branch} className={`flex items-center gap-3 px-5 py-2.5 text-sm ${b.branch === me.branch ? "font-semibold text-primary" : ""}`}>{medal(i)}<span className="flex-1">{b.branch}<span className="block text-xs font-normal text-muted">{b.members} {tx("people", "أشخاص")}</span></span><span className="font-bold">{b.avg}</span></li>))}</ol>
            </section>
            <section className="card p-5 text-sm">
              <h2 className="mb-2 font-bold text-primary-dark">{tx("How to earn points", "كيف تجمع النقاط")}</h2>
              <ul className="space-y-1.5 text-muted">
                <li>+{POINTS.lesson} {tx("for each lesson completed", "لكل درس مكتمل")}</li>
                <li>+{POINTS.certificate} {tx("for each certificate", "لكل شهادة")}</li>
                <li>+{POINTS.dailyCorrect + POINTS.dailyAnswered} {tx("for a correct question of the day", "لإجابة صحيحة على سؤال اليوم")} (+{POINTS.dailyAnswered} {tx("for answering", "للمشاركة")})</li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
