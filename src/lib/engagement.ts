import { Prisma } from "@prisma/client";
import { db } from "./db";
import { shuffle } from "./domain";

/** Points: what counts and how much (shown to learners on the leaderboard page). */
export const POINTS = { lesson: 10, certificate: 100, dailyCorrect: 5, dailyAnswered: 1 } as const;

/** Calendar day in Egypt (YYYY-MM-DD). */
export function cairoDay(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export interface DailyView {
  day: string;
  questionId: string;
  promptEn: string; promptAr: string | null;
  courseTitle: string; courseTitleAr: string | null;
  options: { id: string; textEn: string; textAr: string | null }[];
  answered: boolean; correct: boolean; chosenId: string | null; correctId: string | null;
  streak: number;
}

/**
 * Picks the learner's question of the day from lessons they have completed (spaced review):
 * questions they got wrong before come first, recently asked ones are skipped.
 * Returns null when the learner has not completed any lesson with a quiz yet.
 */
async function pickQuestion(userId: string, day: string) {
  const done = await db.lessonProgress.findMany({ where: { userId, completedAt: { not: null } }, select: { lessonId: true } });
  if (!done.length) return null;
  const pool = await db.quizQuestion.findMany({
    where: { quiz: { status: "PUBLISHED", lessonId: { in: done.map((d) => d.lessonId) } } },
    select: { id: true },
  });
  if (!pool.length) return null;
  const recent = new Set((await db.dailyAnswer.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 30, select: { questionId: true } })).map((r) => r.questionId));
  const wrong = new Set((await db.quizAnswer.findMany({ where: { isCorrect: false, attempt: { userId }, questionId: { in: pool.map((p) => p.id) } }, select: { questionId: true }, take: 500 })).map((r) => r.questionId));
  const fresh = pool.filter((p) => !recent.has(p.id));
  const candidates = fresh.filter((p) => wrong.has(p.id));
  const list = candidates.length ? candidates : fresh.length ? fresh : pool;
  return list[hash(userId + day) % list.length].id;
}

export async function streakOf(userId: string, today = cairoDay()) {
  const rows = await db.dailyAnswer.findMany({ where: { userId, answeredAt: { not: null } }, orderBy: { day: "desc" }, take: 400, select: { day: true } });
  const days = new Set(rows.map((r) => r.day));
  let n = 0;
  const d = new Date(`${today}T12:00:00Z`);
  if (!days.has(today)) d.setUTCDate(d.getUTCDate() - 1); // today not answered yet: streak still alive from yesterday
  while (days.has(d.toISOString().slice(0, 10))) { n++; d.setUTCDate(d.getUTCDate() - 1); }
  return n;
}

export async function getDaily(userId: string, now = new Date()): Promise<DailyView | null> {
  const day = cairoDay(now);
  let row = await db.dailyAnswer.findUnique({ where: { userId_day: { userId, day } } });
  if (!row) {
    const questionId = await pickQuestion(userId, day);
    if (!questionId) return null;
    try {
      row = await db.dailyAnswer.create({ data: { userId, day, questionId } });
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
      row = await db.dailyAnswer.findUniqueOrThrow({ where: { userId_day: { userId, day } } });
    }
  }
  const q = await db.quizQuestion.findUnique({ where: { id: row.questionId }, include: { options: true, quiz: { select: { course: { select: { titleEn: true, titleAr: true } } } } } });
  if (!q) return null;
  const answered = !!row.answeredAt;
  const order = shuffle(q.options, (() => { let s = hash(row.id); return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) >>> 0) / 4294967296); })());
  return {
    day, questionId: q.id, promptEn: q.promptEn, promptAr: q.promptAr,
    courseTitle: q.quiz.course.titleEn, courseTitleAr: q.quiz.course.titleAr,
    options: order.map((o) => ({ id: o.id, textEn: o.textEn, textAr: o.textAr })),
    answered, correct: row.correct, chosenId: row.optionId,
    // the correct option is revealed only after the learner has answered
    correctId: answered ? q.options.find((o) => o.isCorrect)?.id ?? null : null,
    streak: await streakOf(userId, day),
  };
}

export async function answerDaily(userId: string, optionId: string, now = new Date()) {
  const day = cairoDay(now);
  const row = await db.dailyAnswer.findUnique({ where: { userId_day: { userId, day } } });
  if (!row) throw new Error("No question today");
  if (row.answeredAt) return { correct: row.correct, already: true };
  const opt = await db.quizOption.findFirst({ where: { id: optionId, questionId: row.questionId } });
  if (!opt) throw new Error("Invalid answer");
  const r = await db.dailyAnswer.updateMany({ where: { id: row.id, answeredAt: null }, data: { optionId, correct: opt.isCorrect, answeredAt: now } });
  return { correct: opt.isCorrect, already: r.count === 0 };
}

export interface ScoreRow { userId: string; name: string; branch: string | null; area: string | null; role: string | null; points: number; lessons: number; certificates: number; dailyCorrect: number }

/** Points for a set of users (or all active learners), highest first. */
export async function leaderboard(where: Prisma.UserWhereInput = {}, since?: Date): Promise<ScoreRow[]> {
  const users = await db.user.findMany({
    where: { status: "ACTIVE", deletedAt: null, roles: { every: { role: { key: "STUDENT" } } }, ...where },
    select: { id: true, firstName: true, lastName: true, branch: true, area: true, audience: { select: { nameEn: true } } },
    take: 10000,
  });
  const ids = users.map((u) => u.id);
  if (!ids.length) return [];
  const t = since ? { gte: since } : undefined;
  const [lessons, certs, daily, answered] = await Promise.all([
    db.lessonProgress.groupBy({ by: ["userId"], where: { userId: { in: ids }, completedAt: t ?? { not: null } }, _count: true }),
    db.certificate.groupBy({ by: ["userId"], where: { userId: { in: ids }, revokedAt: null, ...(t ? { issuedAt: t } : {}) }, _count: true }),
    db.dailyAnswer.groupBy({ by: ["userId"], where: { userId: { in: ids }, correct: true, ...(t ? { answeredAt: t } : {}) }, _count: true }),
    db.dailyAnswer.groupBy({ by: ["userId"], where: { userId: { in: ids }, answeredAt: t ?? { not: null } }, _count: true }),
  ]);
  const m = (rows: { userId: string; _count: number }[]) => new Map(rows.map((r) => [r.userId, r._count]));
  const [l, c, d, a] = [m(lessons), m(certs), m(daily), m(answered)];
  return users.map((u) => {
    const lessons = l.get(u.id) ?? 0, certificates = c.get(u.id) ?? 0, dailyCorrect = d.get(u.id) ?? 0;
    const points = lessons * POINTS.lesson + certificates * POINTS.certificate + dailyCorrect * POINTS.dailyCorrect + (a.get(u.id) ?? 0) * POINTS.dailyAnswered;
    return { userId: u.id, name: `${u.firstName} ${u.lastName}`.trim(), branch: u.branch, area: u.area, role: u.audience?.nameEn ?? null, points, lessons, certificates, dailyCorrect };
  }).sort((x, y) => y.points - x.points || x.name.localeCompare(y.name));
}

/** Branch ranking: average points per member (fair to small and large branches). */
export function branchBoard(rows: ScoreRow[]) {
  const m = new Map<string, ScoreRow[]>();
  for (const r of rows) if (r.branch) m.set(r.branch, [...(m.get(r.branch) ?? []), r]);
  return [...m.entries()].map(([branch, rs]) => ({ branch, area: rs[0].area, members: rs.length, total: rs.reduce((s, r) => s + r.points, 0), avg: Math.round(rs.reduce((s, r) => s + r.points, 0) / rs.length) }))
    .sort((a, b) => b.avg - a.avg);
}
