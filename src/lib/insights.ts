import { Prisma } from "@prisma/client";
import { db } from "./db";

export interface InsightFilter { courseId?: string; branch?: string; area?: string; audienceId?: string; days?: number }

function userFilter(f: InsightFilter) {
  const parts: Prisma.Sql[] = [Prisma.sql`at."submittedAt" IS NOT NULL`];
  if (f.branch) parts.push(Prisma.sql`lower(u.branch) = lower(${f.branch})`);
  if (f.area) parts.push(Prisma.sql`lower(u.area) = lower(${f.area})`);
  if (f.audienceId) parts.push(Prisma.sql`u."audienceId" = ${f.audienceId}`);
  if (f.courseId) parts.push(Prisma.sql`qz."courseId" = ${f.courseId}`);
  if (f.days) parts.push(Prisma.sql`at."submittedAt" > now() - make_interval(days => ${f.days}::int)`);
  return Prisma.join(parts, " AND ");
}

export interface QuestionStat {
  questionId: string; promptEn: string; promptAr: string | null; courseTitle: string; lessonTitle: string | null; isFinal: boolean;
  served: number; correct: number; rate: number;
  topWrong: { textEn: string; textAr: string | null; picks: number } | null;
}

/** Hardest questions first (lowest correct rate), with the most-picked wrong answer — shows real knowledge gaps. */
export async function questionStats(f: InsightFilter, minServed = 5, limit = 50): Promise<QuestionStat[]> {
  const where = userFilter(f);
  const rows = await db.$queryRaw<{ questionId: string; served: bigint; correct: bigint }[]>`
    SELECT qa."questionId", count(*) AS served, count(*) FILTER (WHERE qa."isCorrect") AS correct
    FROM "QuizAnswer" qa
    JOIN "QuizAttempt" at ON at.id = qa."attemptId"
    JOIN "Quiz" qz ON qz.id = at."quizId"
    JOIN "User" u ON u.id = at."userId"
    WHERE ${where}
    GROUP BY qa."questionId"
    HAVING count(*) >= ${minServed}
    ORDER BY (count(*) FILTER (WHERE qa."isCorrect"))::float / count(*) ASC, count(*) DESC
    LIMIT ${limit}`;
  if (!rows.length) return [];
  const ids = rows.map((r) => r.questionId);
  const wrong = await db.$queryRaw<{ questionId: string; optionId: string; picks: bigint }[]>`
    SELECT DISTINCT ON (qa."questionId") qa."questionId", o AS "optionId", count(*) AS picks
    FROM "QuizAnswer" qa
    JOIN "QuizAttempt" at ON at.id = qa."attemptId"
    JOIN "Quiz" qz ON qz.id = at."quizId"
    JOIN "User" u ON u.id = at."userId"
    CROSS JOIN LATERAL unnest(qa."optionIds") AS o
    WHERE ${where} AND NOT qa."isCorrect" AND qa."questionId" IN (${Prisma.join(ids)})
    GROUP BY qa."questionId", o
    ORDER BY qa."questionId", count(*) DESC`;
  const qs = await db.quizQuestion.findMany({
    where: { id: { in: ids } },
    include: { quiz: { select: { lessonId: true, course: { select: { titleEn: true } }, lesson: { select: { titleEn: true } } } }, options: { select: { id: true, textEn: true, textAr: true } } },
  });
  const qm = new Map(qs.map((q) => [q.id, q]));
  const wm = new Map(wrong.map((w) => [w.questionId, w]));
  return rows.flatMap((r) => {
    const q = qm.get(r.questionId);
    if (!q) return [];
    const w = wm.get(r.questionId);
    const opt = w ? q.options.find((o) => o.id === w.optionId) : undefined;
    const served = Number(r.served), correct = Number(r.correct);
    return [{
      questionId: q.id, promptEn: q.promptEn, promptAr: q.promptAr, courseTitle: q.quiz.course.titleEn, lessonTitle: q.quiz.lesson?.titleEn ?? null, isFinal: !q.quiz.lessonId,
      served, correct, rate: Math.round((correct / served) * 100),
      topWrong: opt && w ? { textEn: opt.textEn, textAr: opt.textAr, picks: Number(w.picks) } : null,
    }];
  });
}

export interface CourseBranchCell { courseId: string; courseTitle: string; branch: string; served: number; rate: number }

/** Correct-answer rate per course × branch — a heatmap of where each topic needs more coaching. */
export async function courseBranchMatrix(f: InsightFilter): Promise<CourseBranchCell[]> {
  const rows = await db.$queryRaw<{ courseId: string; courseTitle: string; branch: string; served: bigint; correct: bigint }[]>`
    SELECT qz."courseId", c."titleEn" AS "courseTitle", COALESCE(u.branch, '—') AS branch, count(*) AS served, count(*) FILTER (WHERE qa."isCorrect") AS correct
    FROM "QuizAnswer" qa
    JOIN "QuizAttempt" at ON at.id = qa."attemptId"
    JOIN "Quiz" qz ON qz.id = at."quizId"
    JOIN "Course" c ON c.id = qz."courseId"
    JOIN "User" u ON u.id = at."userId"
    WHERE ${userFilter(f)}
    GROUP BY qz."courseId", c."titleEn", COALESCE(u.branch, '—')`;
  return rows.map((r) => ({ courseId: r.courseId, courseTitle: r.courseTitle, branch: r.branch, served: Number(r.served), rate: Math.round((Number(r.correct) / Number(r.served)) * 100) }));
}

/** Lessons ranked by first-attempt pass rate of their lesson quiz. */
export async function lessonStats(f: InsightFilter, limit = 15) {
  const rows = await db.$queryRaw<{ lessonId: string; lessonTitle: string; courseTitle: string; attempts: bigint; passed: bigint; avg: number }[]>`
    SELECT qz."lessonId", l."titleEn" AS "lessonTitle", c."titleEn" AS "courseTitle",
           count(*) AS attempts, count(*) FILTER (WHERE at.passed) AS passed, avg(at."scorePct")::float AS avg
    FROM "QuizAttempt" at
    JOIN "Quiz" qz ON qz.id = at."quizId"
    JOIN "Lesson" l ON l.id = qz."lessonId"
    JOIN "Course" c ON c.id = qz."courseId"
    JOIN "User" u ON u.id = at."userId"
    WHERE ${userFilter(f)}
    GROUP BY qz."lessonId", l."titleEn", c."titleEn"
    HAVING count(*) >= 3
    ORDER BY count(*) FILTER (WHERE at.passed)::float / count(*) ASC
    LIMIT ${limit}`;
  return rows.map((r) => ({ lessonId: r.lessonId, lessonTitle: r.lessonTitle, courseTitle: r.courseTitle, attempts: Number(r.attempts), passRate: Math.round((Number(r.passed) / Number(r.attempts)) * 100), avgScore: Math.round(r.avg) }));
}
