import { Prisma } from "@prisma/client";
import { db } from "./db";

export const PAGE_SIZE = 9;

export interface CourseQuery {
  q?: string;
  category?: string;
  level?: string;
  duration?: string; // "short" (<=6h) | "medium" (<=10h) | "long" (>10h)
  sort?: string;
  page?: number;
}

export async function listCourses(query: CourseQuery) {
  const and: Prisma.CourseWhereInput[] = [];
  if (query.q) {
    const q = query.q.slice(0, 100);
    and.push({
      OR: [
        { titleEn: { contains: q, mode: "insensitive" } },
        { titleAr: { contains: q } },
        { summaryEn: { contains: q, mode: "insensitive" } },
        { descriptionEn: { contains: q, mode: "insensitive" } },
        { category: { nameEn: { contains: q, mode: "insensitive" } } },
        { instructors: { some: { instructor: { user: { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }] } } } } },
        { tags: { some: { tag: { nameEn: { contains: q, mode: "insensitive" } } } } },
      ],
    });
  }
  if (query.category) and.push({ category: { slug: query.category } });
  if (query.level && ["BEGINNER", "INTERMEDIATE", "ADVANCED"].includes(query.level)) and.push({ level: query.level as "BEGINNER" });
  if (query.duration === "short") and.push({ durationMinutes: { lte: 360 } });
  if (query.duration === "medium") and.push({ durationMinutes: { gt: 360, lte: 600 } });
  if (query.duration === "long") and.push({ durationMinutes: { gt: 600 } });
  const where: Prisma.CourseWhereInput = { status: "PUBLISHED", deletedAt: null, AND: and };
  const orderBy: Prisma.CourseOrderByWithRelationInput[] =
    query.sort === "popular" ? [{ enrollments: { _count: "desc" } }, { sortOrder: "asc" }]
    : query.sort === "title" ? [{ titleEn: "asc" }]
    : query.sort === "duration" ? [{ durationMinutes: "asc" }]
    : query.sort === "newest" ? [{ publishedAt: "desc" }]
    : [{ sortOrder: "asc" }];
  const page = Math.max(1, query.page ?? 1);
  const [total, items] = await Promise.all([
    db.course.count({ where }),
    db.course.findMany({
      where, orderBy, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      select: {
        id: true, slug: true, titleEn: true, titleAr: true, summaryEn: true, summaryAr: true, level: true, durationMinutes: true, thumbnailUrl: true,
        category: { select: { slug: true, nameEn: true, nameAr: true } },
        instructors: { select: { instructor: { select: { user: { select: { firstName: true, lastName: true } } } } }, take: 1 },
        _count: { select: { lessons: { where: { status: "PUBLISHED", deletedAt: null } } } },
      },
    }),
  ]);
  return { total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), page, items };
}

export type CourseListItem = Awaited<ReturnType<typeof listCourses>>["items"][number];

export async function progressFor(userId: string | undefined, courseIds: string[]) {
  if (!userId || !courseIds.length) return new Map<string, { percent: number; status: string }>();
  const rows = await db.enrollment.findMany({ where: { userId, courseId: { in: courseIds } }, select: { courseId: true, status: true } });
  const prog = await db.courseProgress.findMany({ where: { userId, courseId: { in: courseIds } } });
  const pm = new Map(prog.map((p) => [p.courseId, p.percent]));
  return new Map(rows.map((r) => [r.courseId, { percent: pm.get(r.courseId) ?? 0, status: r.status }]));
}
