"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertPermission, requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { answerDaily } from "@/lib/engagement";
import { nudge, runReminders } from "@/lib/reminders";
import { inScope, managerScope } from "@/lib/team";
import { assignPathToRole } from "@/lib/paths";

type State = { error?: string; ok?: string } | null;

// ---------- Question of the day ----------
export async function answerDailyAction(fd: FormData) {
  const user = await requireUser();
  const optionId = String(fd.get("optionId") ?? "");
  if (optionId) await answerDaily(user.id, optionId);
  revalidatePath("/dashboard");
}

// ---------- Managers ----------
export async function nudgeAction(fd: FormData) {
  const user = await requireUser();
  const scope = await managerScope(user);
  const ids = fd.getAll("userId").map(String).filter(Boolean).slice(0, 500);
  if (!scope || !ids.length) redirect("/team");
  let sent = 0;
  for (const id of ids) {
    if (!(await inScope(scope, id, user.id))) continue;
    if (await nudge(`${user.firstName} ${user.lastName}`.trim(), id)) sent++;
  }
  await audit(user.id, "team.nudge", "User", ids.length === 1 ? ids[0] : undefined, { count: sent });
  const back = String(fd.get("back") ?? "/team");
  redirect(`${back.startsWith("/team") ? back : "/team"}${back.includes("?") ? "&" : "?"}nudged=${sent}`);
}

// ---------- Reminders ----------
export async function runRemindersAction(_: State): Promise<State> {
  const user = await assertPermission("settings.write");
  const r = await runReminders();
  await audit(user.id, "reminders.run", undefined, undefined, { ...r });
  revalidatePath("/admin/notifications");
  return { ok: `Done: ${r.dueSoon} due-soon, ${r.overdue} overdue, ${r.renewals} renewals, ${r.digests} manager digests, ${r.assigned} new assignments.` };
}

// ---------- Learning paths ----------
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
const pathSchema = z.object({
  titleEn: z.string().trim().min(2).max(200),
  titleAr: z.string().trim().max(200).optional(),
  descriptionEn: z.string().trim().max(2000).optional(),
  descriptionAr: z.string().trim().max(2000).optional(),
  audienceId: z.string().optional(),
  dueDays: z.coerce.number().int().min(0).max(3650).optional(),
  autoAssignNewHires: z.string().optional(),
  published: z.string().optional(),
});

export async function createPathAction(_: State, fd: FormData): Promise<State> {
  const user = await assertPermission("courses.write");
  const p = pathSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Title is required." };
  let slug = slugify(p.data.titleEn) || "path";
  if (await db.learningPath.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
  const path = await db.learningPath.create({ data: { slug, titleEn: p.data.titleEn, titleAr: p.data.titleAr || null, audienceId: p.data.audienceId || null } });
  await audit(user.id, "path.create", "LearningPath", path.id);
  redirect(`/admin/paths/${path.id}`);
}

export async function updatePathAction(_: State, fd: FormData): Promise<State> {
  const user = await assertPermission("courses.write");
  const id = String(fd.get("id"));
  const p = pathSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const d = p.data;
  await db.learningPath.update({ where: { id }, data: {
    titleEn: d.titleEn, titleAr: d.titleAr || null, descriptionEn: d.descriptionEn || null, descriptionAr: d.descriptionAr || null,
    audienceId: d.audienceId || null, dueDays: d.dueDays || null, autoAssignNewHires: d.autoAssignNewHires === "on", published: d.published === "on",
  } });
  await audit(user.id, "path.update", "LearningPath", id);
  revalidatePath(`/admin/paths/${id}`);
  return { ok: "Saved." };
}

async function renumber(pathId: string, order: string[]) {
  await db.$transaction(async (tx) => {
    // two passes avoid clashes while positions are being swapped
    for (const [i, courseId] of order.entries()) await tx.learningPathCourse.update({ where: { pathId_courseId: { pathId, courseId } }, data: { position: 1000 + i } });
    for (const [i, courseId] of order.entries()) await tx.learningPathCourse.update({ where: { pathId_courseId: { pathId, courseId } }, data: { position: i } });
  });
}

export async function pathCourseAction(fd: FormData) {
  const user = await assertPermission("courses.write");
  const pathId = String(fd.get("pathId"));
  const courseId = String(fd.get("courseId") ?? "");
  const op = String(fd.get("op"));
  const rows = await db.learningPathCourse.findMany({ where: { pathId }, orderBy: { position: "asc" } });
  const order = rows.map((r) => r.courseId);
  if (op === "add" && courseId && !order.includes(courseId)) {
    await db.learningPathCourse.create({ data: { pathId, courseId, position: order.length } });
  } else if (op === "remove") {
    await db.learningPathCourse.delete({ where: { pathId_courseId: { pathId, courseId } } });
    await renumber(pathId, order.filter((c) => c !== courseId));
  } else if (op === "up" || op === "down") {
    const i = order.indexOf(courseId);
    const j = op === "up" ? i - 1 : i + 1;
    if (i >= 0 && j >= 0 && j < order.length) { [order[i], order[j]] = [order[j], order[i]]; await renumber(pathId, order); }
  }
  await audit(user.id, `path.course.${op}`, "LearningPath", pathId, { courseId });
  revalidatePath(`/admin/paths/${pathId}`);
}

export async function assignPathRoleAction(_: State, fd: FormData): Promise<State> {
  const user = await assertPermission("courses.write");
  const pathId = String(fd.get("pathId"));
  const path = await db.learningPath.findUnique({ where: { id: pathId }, include: { _count: { select: { courses: true } } } });
  if (!path?.published) return { error: "Publish the path first." };
  if (!path._count.courses) return { error: "Add at least one course first." };
  const n = await assignPathToRole(pathId);
  await audit(user.id, "path.assign_role", "LearningPath", pathId, { count: n });
  revalidatePath(`/admin/paths/${pathId}`);
  return { ok: `Assigned to ${n} member${n === 1 ? "" : "s"} of staff.` };
}

export async function deletePathAction(fd: FormData) {
  const user = await assertPermission("courses.write");
  const id = String(fd.get("id"));
  await db.learningPath.delete({ where: { id } });
  await audit(user.id, "path.delete", "LearningPath", id);
  redirect("/admin/paths");
}

/** A learner starts a published path that is open to their job role. */
export async function startPathAction(fd: FormData) {
  const user = await requireUser();
  const id = String(fd.get("pathId"));
  const me = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { audienceId: true } });
  const path = await db.learningPath.findFirst({ where: { id, published: true, OR: [{ audienceId: null }, { audienceId: me.audienceId ?? "-" }] } });
  if (!path) redirect("/paths");
  const { assignPath } = await import("@/lib/paths");
  await assignPath(user.id, path.id);
  redirect(`/paths/${path.slug}`);
}
