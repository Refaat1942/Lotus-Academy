import { Prisma } from "@prisma/client";
import { db } from "./db";
import { env } from "./env";
import { sendMail } from "./mail";
import { log } from "./log";
import { syncAssignments } from "./audience";
import { openRenewal } from "./learning";
import { managerScope, teamMembers } from "./team";

const DAY = 86400_000;

/** ISO week label, e.g. 2026-W45 (used to send weekly items at most once a week). */
export function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const y = t.getUTCFullYear();
  const week = Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / DAY + 1) / 7);
  return `${y}-W${String(week).padStart(2, "0")}`;
}

/** Records a reminder key; returns false when it was already sent (unique key). */
export async function claimReminder(key: string, userId: string) {
  try {
    await db.reminderLog.create({ data: { key, userId } });
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
    throw e;
  }
}

async function notify(user: { id: string; email: string; firstName: string }, title: string, message: string, messageAr: string, href: string) {
  await db.notification.create({ data: { userId: user.id, type: "reminder", title, body: message, href } });
  void sendMail(user.email, "training_reminder", { name: user.firstName, subject: title, message, messageAr, url: `${env.appUrl()}${href}` });
}

const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export interface ReminderRun { dueSoon: number; overdue: number; renewals: number; digests: number; assigned: number }

/**
 * Daily/hourly job (idempotent — every reminder has a unique key):
 *  1. due in ≤ 7 days and ≤ 1 day → reminder to the learner
 *  2. overdue → weekly reminder to the learner
 *  3. certificate expiring within 30 days (or expired) → open renewal + reminder
 *  4. weekly digest to each manager whose team has overdue training
 */
export async function runReminders(now = new Date()): Promise<ReminderRun> {
  const out: ReminderRun = { dueSoon: 0, overdue: 0, renewals: 0, digests: 0, assigned: 0 };
  out.assigned = await syncAssignments();
  const week = isoWeek(now);

  // 3. renewals first, so the renewed enrolments get due dates for the checks below
  const expiring = await db.certificate.findMany({
    where: { revokedAt: null, expiresAt: { not: null, lt: new Date(now.getTime() + 30 * DAY) }, user: { status: "ACTIVE", deletedAt: null } },
    include: { user: { select: { id: true, email: true, firstName: true } }, course: { select: { titleEn: true, titleAr: true, slug: true } } },
  });
  for (const c of expiring) {
    if (await openRenewal(c.userId, c.courseId, now) && await claimReminder(`renew:${c.id}:${c.expiresAt!.toISOString().slice(0, 10)}`, c.userId)) {
      const expired = c.expiresAt! < now;
      await notify(c.user, `Certificate renewal: ${c.course.titleEn}`,
        `${expired ? "Your certificate has expired" : `Your certificate expires on ${fmt(c.expiresAt!)}`}. Retake the final exam of "${c.course.titleEn}" to renew it.`,
        `${expired ? "انتهت صلاحية شهادتك" : `تنتهي صلاحية شهادتك في ${fmt(c.expiresAt!)}`}. أعد الامتحان النهائي لكورس "${c.course.titleAr ?? c.course.titleEn}" لتجديدها.`,
        `/learn/${c.course.slug}/final-exam`);
      out.renewals++;
    }
  }

  // 1 + 2. learners with dated, unfinished training
  const open = await db.enrollment.findMany({
    where: { status: "ACTIVE", dueAt: { not: null, lt: new Date(now.getTime() + 7 * DAY) }, user: { status: "ACTIVE", deletedAt: null } },
    include: { user: { select: { id: true, email: true, firstName: true } }, course: { select: { titleEn: true, titleAr: true, slug: true } } },
  });
  for (const e of open) {
    const due = e.dueAt!;
    const left = due.getTime() - now.getTime();
    const href = `/courses/${e.course.slug}`;
    if (left < 0) {
      if (await claimReminder(`overdue:${e.id}:${week}`, e.userId)) {
        await notify(e.user, `Overdue: ${e.course.titleEn}`, `"${e.course.titleEn}" was due on ${fmt(due)}. Please complete it as soon as possible.`, `كان موعد إنهاء "${e.course.titleAr ?? e.course.titleEn}" في ${fmt(due)}. برجاء إكماله في أقرب وقت.`, href);
        out.overdue++;
      }
    } else {
      const kind = left <= DAY ? "due1" : "due7";
      if (await claimReminder(`${kind}:${e.id}:${due.toISOString().slice(0, 10)}`, e.userId)) {
        await notify(e.user, `Reminder: ${e.course.titleEn} is due ${kind === "due1" ? "tomorrow" : `on ${fmt(due)}`}`,
          `Your required course "${e.course.titleEn}" is due on ${fmt(due)}.`, `موعد إنهاء الكورس الإلزامي "${e.course.titleAr ?? e.course.titleEn}" هو ${fmt(due)}.`, href);
        out.dueSoon++;
      }
    }
  }

  // 4. weekly digest for managers
  const managers = await db.user.findMany({
    where: { status: "ACTIVE", deletedAt: null, audience: { key: { in: ["BRANCH_MANAGER", "AREA_MANAGER", "DEPARTMENT_MANAGER"] } } },
    select: { id: true, email: true, firstName: true },
  });
  for (const m of managers) {
    const scope = await managerScope({ id: m.id, permissions: new Set() });
    if (!scope) continue;
    const rows = (await teamMembers(scope, m.id)).filter((r) => r.overdue > 0);
    if (!rows.length) continue;
    if (!(await claimReminder(`digest:${m.id}:${week}`, m.id))) continue;
    const title = `Team training: ${rows.length} member${rows.length > 1 ? "s" : ""} with overdue courses`;
    const list = rows.map((r) => `• ${r.name}${r.branch ? ` (${r.branch})` : ""} — ${r.overdue} overdue, ${r.requiredDone}/${r.required} required done`).join("\n");
    await db.notification.create({ data: { userId: m.id, type: "digest", title, href: "/team?status=overdue" } });
    void sendMail(m.email, "manager_digest", { name: m.firstName, subject: title, message: `This week ${rows.length} people in your ${scope.kind} have overdue required training:`, list, url: `${env.appUrl()}/team` });
    out.digests++;
  }
  log("info", "reminders.run", { ...out });
  return out;
}

/** A manager (or admin) nudges one learner — at most once per learner per day. */
export async function nudge(fromName: string, userId: string, now = new Date()) {
  const u = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, firstName: true } });
  if (!u) return false;
  if (!(await claimReminder(`nudge:${userId}:${now.toISOString().slice(0, 10)}`, userId))) return false;
  const pending = await db.enrollment.count({ where: { userId, status: "ACTIVE", source: "assigned" } });
  await notify(u, "A reminder from your manager", `${fromName} reminds you to continue your training (${pending} required course${pending === 1 ? "" : "s"} open).`, `${fromName} يذكّرك بإكمال تدريبك (${pending} كورس إلزامي مفتوح).`, "/dashboard");
  return true;
}

