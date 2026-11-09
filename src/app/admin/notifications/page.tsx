import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/i18n";
import { AdminTitle } from "@/components/admin";
import { ActionForm } from "@/components/ui/ActionForm";
import { broadcastAction } from "@/app/actions/admin";
import { runRemindersAction } from "@/app/actions/engagement";

export const dynamic = "force-dynamic";

export default async function Notifications() {
  await requirePermission("settings.write");
  const { t } = await getT();
  const week = new Date(Date.now() - 7 * 86400_000);
  const [lastRun, recent] = await Promise.all([
    db.reminderLog.findFirst({ where: { key: { startsWith: "run:" } }, orderBy: { createdAt: "desc" } }),
    db.reminderLog.findMany({ where: { createdAt: { gte: week }, NOT: { key: { startsWith: "run:" } } }, select: { key: true } }),
  ]);
  const kinds = recent.reduce<Record<string, number>>((m, r) => { const k = r.key.split(":")[0]; m[k] = (m[k] ?? 0) + 1; return m; }, {});
  const KIND: Record<string, string> = { due7: "Due within 7 days", due1: "Due tomorrow", overdue: "Overdue (weekly)", renew: "Certificate renewals", digest: "Manager weekly digests", nudge: "Manager reminders" };
  const courses = await db.course.findMany({ where: { status: "PUBLISHED" }, select: { id: true, titleEn: true }, orderBy: { sortOrder: "asc" } });
  return (
    <>
      <AdminTitle title={t("admin.notifications")} />
      <section className="card mb-6 max-w-2xl p-5">
        <h2 className="mb-1 font-semibold">Automatic reminders</h2>
        <p className="mb-3 text-sm text-muted">Runs every hour on the server. Learners get an in-app notification and an email (when SMTP is configured) 7 days and 1 day before a mandatory course is due, then weekly while it is overdue. Certificates with a validity period open a renewal 30 days before they expire. Branch, area and department managers get a weekly summary of their team&apos;s overdue training. Each reminder is sent once.</p>
        <p className="mb-3 text-sm">Last automatic run: <strong>{lastRun ? lastRun.createdAt.toLocaleString("en-GB") : "not yet"}</strong></p>
        <ul className="mb-4 grid gap-1 text-sm sm:grid-cols-2">{Object.entries(KIND).map(([k, label]) => <li key={k} className="flex justify-between rounded bg-background px-3 py-1.5"><span>{label}</span><strong>{kinds[k] ?? 0}</strong></li>)}</ul>
        <p className="mb-2 text-xs text-muted">Counts for the last 7 days.</p>
        <ActionForm action={runRemindersAction} submitLabel="Run reminders now" buttonClass="btn-secondary">{null}</ActionForm>
      </section>
      <section className="card max-w-2xl p-5"><h2 className="mb-1 font-semibold">Send announcement</h2><p className="mb-4 text-sm text-muted">Creates an in-app notification. When a course is selected, enrolled learners also get a “course updated” email.</p>
        <ActionForm action={broadcastAction} submitLabel="Send" buttonClass="btn-primary">
          <div><label className="label" htmlFor="courseId">Audience</label><select id="courseId" name="courseId" className="input"><option value="">All students</option>{courses.map((c) => <option key={c.id} value={c.id}>Enrolled in: {c.titleEn}</option>)}</select></div>
          <div><label className="label" htmlFor="title">Title</label><input id="title" name="title" required maxLength={200} className="input" /></div>
          <div><label className="label" htmlFor="body">Message</label><textarea id="body" name="body" rows={3} maxLength={1000} className="input" /></div>
        </ActionForm></section>
    </>
  );
}
