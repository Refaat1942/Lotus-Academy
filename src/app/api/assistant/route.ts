import { z } from "zod";
import { getCurrentUser, clientIp } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import { isLessonUnlocked } from "@/lib/domain";
import { askClaude, assistantConfigured, buildSystemPrompt, logAssistantError, retrievalAnswer, type CourseCtx } from "@/lib/assistant";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const body = z.object({ courseId: z.string().min(5).max(40), lessonId: z.string().min(5).max(40), message: z.string().trim().min(1).max(1000) });

/** Same-origin only (the endpoint is cookie-authenticated). */
function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try { return new URL(origin).host === host; } catch { return false; }
}

async function access(userId: string, courseId: string) {
  const enr = await db.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
  return !!enr && enr.status !== "CANCELLED";
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const courseId = new URL(req.url).searchParams.get("courseId") ?? "";
  if (!(await access(user.id, courseId))) return Response.json({ error: "Forbidden" }, { status: 403 });
  const rows = await db.chatMessage.findMany({ where: { userId: user.id, courseId }, orderBy: { createdAt: "desc" }, take: 20 });
  return Response.json({ messages: rows.reverse().map((m) => ({ role: m.role, content: m.content })), ai: assistantConfigured() });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { courseId, lessonId, message } = parsed.data;

  if (!(await rateLimit(`assist-h:${user.id}`, 30, 3600)) || !(await rateLimit(`assist-d:${user.id}`, 150, 86400)) || !(await rateLimit(`assist-ip:${await clientIp()}`, 120, 3600)))
    return Response.json({ error: "You're asking a lot of questions. Please try again in a little while." }, { status: 429 });
  if (!(await access(user.id, courseId))) return Response.json({ error: "Forbidden" }, { status: 403 });

  const course = await db.course.findFirst({
    where: { id: courseId, status: "PUBLISHED", deletedAt: null },
    include: { modules: { orderBy: { position: "asc" }, include: { lessons: { where: { status: "PUBLISHED", deletedAt: null }, orderBy: { position: "asc" } } } } },
  });
  if (!course) return Response.json({ error: "Not found" }, { status: 404 });
  const lessons = course.modules.flatMap((m) => m.lessons);
  const idx = lessons.findIndex((l) => l.id === lessonId);
  if (idx === -1) return Response.json({ error: "Not found" }, { status: 404 });
  const done = new Set((await db.lessonProgress.findMany({ where: { userId: user.id, courseId, completedAt: { not: null } }, select: { lessonId: true } })).map((p) => p.lessonId));
  if (course.sequential && !isLessonUnlocked(lessons, done, idx)) return Response.json({ error: "Lesson locked" }, { status: 403 });

  const current = lessons[idx];
  const ctx: CourseCtx = {
    title: course.titleEn, objectives: course.objectivesEn,
    // outline lists only lessons the learner may already see (no spoilers beyond the next one)
    outline: course.modules.map((m) => ({ module: m.titleEn, lessons: m.lessons.filter((l) => lessons.indexOf(l) <= idx + 1).map((l) => l.titleEn) })).filter((m) => m.lessons.length),
    current: { title: current.titleEn, body: current.bodyMd }, previous: [],
  };
  const history = (await db.chatMessage.findMany({ where: { userId: user.id, courseId }, orderBy: { createdAt: "desc" }, take: 6 })).reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  let reply: string;
  let mode: "ai" | "search" = "search";
  if (assistantConfigured()) {
    try { reply = await askClaude(buildSystemPrompt(ctx), history, message); mode = "ai"; }
    catch (e) { logAssistantError(e); reply = retrievalAnswer(message, ctx.current); }
  } else reply = retrievalAnswer(message, ctx.current);

  await db.chatMessage.createMany({ data: [{ userId: user.id, courseId, lessonId, role: "user", content: message }, { userId: user.id, courseId, lessonId, role: "assistant", content: reply }] });
  return Response.json({ reply, mode });
}
