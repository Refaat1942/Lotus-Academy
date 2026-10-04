"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertPermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { ContentStatus, CourseLevel } from "@prisma/client";
import { sendMail } from "@/lib/mail";

type State = { error?: string; ok?: string } | null;
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

// ---------- Courses ----------
const courseSchema = z.object({
  titleEn: z.string().trim().min(2).max(200),
  titleAr: z.string().trim().max(200).optional(),
  summaryEn: z.string().trim().max(500).optional(),
  summaryAr: z.string().trim().max(500).optional(),
  descriptionEn: z.string().trim().max(10000).optional(),
  descriptionAr: z.string().trim().max(10000).optional(),
  objectivesEn: z.string().max(5000).optional(),
  objectivesAr: z.string().max(5000).optional(),
  prerequisitesEn: z.string().max(1000).optional(),
  categoryId: z.string().optional(),
  level: z.nativeEnum(CourseLevel),
  durationMinutes: z.coerce.number().int().min(0).max(100000),
  passMark: z.coerce.number().int().min(0).max(100),
  thumbnailUrl: z.string().trim().max(500).refine((v) => !v || /^(https:\/\/|\/)/.test(v), "Thumbnail must be an https URL or a /path").optional(),
});

export async function createCourseAction(_: State, fd: FormData): Promise<State> {
  const user = await assertPermission("courses.write");
  const title = String(fd.get("titleEn") ?? "").trim();
  if (title.length < 2) return { error: "Title is required." };
  let slug = slugify(title) || "course";
  if (await db.course.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
  const c = await db.course.create({ data: { slug, titleEn: title, status: "DRAFT", modules: { create: { position: 1, titleEn: "Course lessons", titleAr: "دروس الدورة" } } } });
  await audit(user.id, "course.create", "Course", c.id);
  redirect(`/admin/courses/${c.id}`);
}

export async function updateCourseAction(_: State, fd: FormData): Promise<State> {
  const user = await assertPermission("courses.write");
  const id = String(fd.get("id"));
  const p = courseSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const d = p.data;
  await db.course.update({
    where: { id },
    data: {
      titleEn: d.titleEn, titleAr: d.titleAr || null, summaryEn: d.summaryEn || null, summaryAr: d.summaryAr || null,
      descriptionEn: d.descriptionEn || null, descriptionAr: d.descriptionAr || null,
      objectivesEn: lines(d.objectivesEn ?? ""), objectivesAr: lines(d.objectivesAr ?? ""), prerequisitesEn: d.prerequisitesEn || null,
      categoryId: d.categoryId || null, level: d.level, durationMinutes: d.durationMinutes, passMark: d.passMark, thumbnailUrl: d.thumbnailUrl || null,
    },
  });
  await audit(user.id, "course.update", "Course", id);
  revalidatePath("/admin/courses");
  return { ok: "Saved." };
}

export async function setCourseStatusAction(fd: FormData) {
  const id = String(fd.get("id"));
  const status = z.nativeEnum(ContentStatus).parse(fd.get("status"));
  const user = await assertPermission(status === "PUBLISHED" || status === "ARCHIVED" ? "courses.publish" : "courses.write");
  await db.course.update({ where: { id }, data: { status, publishedAt: status === "PUBLISHED" ? new Date() : undefined } });
  await audit(user.id, `course.${status.toLowerCase()}`, "Course", id);
  revalidatePath("/admin/courses");
  revalidatePath("/courses");
}

export async function assignInstructorAction(_: State, fd: FormData): Promise<State> {
  const user = await assertPermission("courses.write");
  const courseId = String(fd.get("courseId"));
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const u = await db.user.findUnique({ where: { email }, include: { roles: { include: { role: true } } } });
  if (!u || !u.roles.some((r) => r.role.key === "INSTRUCTOR")) return { error: "No user with the INSTRUCTOR role has that email." };
  await db.instructorProfile.upsert({ where: { userId: u.id }, update: {}, create: { userId: u.id } });
  await db.courseInstructor.upsert({ where: { courseId_instructorId: { courseId, instructorId: u.id } }, update: {}, create: { courseId, instructorId: u.id } });
  await audit(user.id, "course.assign_instructor", "Course", courseId, { instructor: u.id });
  revalidatePath(`/admin/courses/${courseId}`);
  return { ok: "Instructor assigned." };
}

export async function removeInstructorAction(fd: FormData) {
  const user = await assertPermission("courses.write");
  const courseId = String(fd.get("courseId"));
  await db.courseInstructor.delete({ where: { courseId_instructorId: { courseId, instructorId: String(fd.get("instructorId")) } } });
  await audit(user.id, "course.remove_instructor", "Course", courseId);
  revalidatePath(`/admin/courses/${courseId}`);
}

// ---------- Lessons ----------
const lessonSchema = z.object({
  titleEn: z.string().trim().min(1).max(200),
  titleAr: z.string().trim().max(200).optional(),
  bodyMd: z.string().max(200000),
  durationMinutes: z.coerce.number().int().min(0).max(10000),
  objectives: z.string().max(5000).optional(),
  status: z.nativeEnum(ContentStatus),
  isPreview: z.string().optional(),
});

export async function updateLessonAction(_: State, fd: FormData): Promise<State> {
  const user = await assertPermission("lessons.write");
  const id = String(fd.get("id"));
  const p = lessonSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const d = p.data;
  if (d.status === "PUBLISHED") await assertPermission("courses.publish");
  const lesson = await db.lesson.update({
    where: { id },
    data: { titleEn: d.titleEn, titleAr: d.titleAr || null, bodyMd: d.bodyMd, durationMinutes: d.durationMinutes, objectives: lines(d.objectives ?? ""), status: d.status, isPreview: d.isPreview === "on", searchText: `${d.titleEn} ${d.bodyMd}`.slice(0, 20000) },
  });
  await audit(user.id, "lesson.update", "Lesson", id);
  revalidatePath(`/admin/courses/${lesson.courseId}`);
  return { ok: "Saved." };
}

export async function createLessonAction(fd: FormData) {
  const user = await assertPermission("lessons.write");
  const courseId = String(fd.get("courseId"));
  const mod = await db.courseModule.findFirstOrThrow({ where: { courseId }, orderBy: { position: "asc" } });
  const last = await db.lesson.findFirst({ where: { courseId }, orderBy: { position: "desc" } });
  const position = (last?.position ?? 0) + 1;
  const l = await db.lesson.create({ data: { courseId, moduleId: mod.id, slug: `lesson-${Date.now().toString(36)}`, titleEn: "New lesson", position, status: "DRAFT" } });
  await audit(user.id, "lesson.create", "Lesson", l.id);
  redirect(`/admin/courses/${courseId}/lessons/${l.id}`);
}

/** Moves a lesson up/down by swapping positions inside a transaction (unique-safe via temporary park value). */
export async function moveLessonAction(fd: FormData) {
  const user = await assertPermission("lessons.write");
  const id = String(fd.get("id"));
  const dir = fd.get("dir") === "up" ? -1 : 1;
  const l = await db.lesson.findUniqueOrThrow({ where: { id } });
  const other = await db.lesson.findFirst({ where: { courseId: l.courseId, deletedAt: null, position: dir === -1 ? { lt: l.position } : { gt: l.position } }, orderBy: { position: dir === -1 ? "desc" : "asc" } });
  if (!other) return;
  await db.$transaction([
    db.lesson.update({ where: { id: l.id }, data: { position: -1 } }),
    db.lesson.update({ where: { id: other.id }, data: { position: l.position } }),
    db.lesson.update({ where: { id: l.id }, data: { position: other.position } }),
  ]);
  await audit(user.id, "lesson.reorder", "Lesson", id);
  revalidatePath(`/admin/courses/${l.courseId}`);
}

export async function archiveLessonAction(fd: FormData) {
  const user = await assertPermission("lessons.write");
  const l = await db.lesson.update({ where: { id: String(fd.get("id")) }, data: { status: "ARCHIVED", deletedAt: new Date() } });
  await audit(user.id, "lesson.archive", "Lesson", l.id);
  revalidatePath(`/admin/courses/${l.courseId}`);
}

const videoSchema = z.object({
  lessonId: z.string(),
  provider: z.enum(["YOUTUBE", "VIMEO", "PRIVATE", "OBJECT_STORAGE", "CDN"]),
  externalId: z.string().trim().max(100).optional(),
  url: z.string().trim().url().max(500).refine((u) => u.startsWith("https://"), "https only"),
  durationSec: z.coerce.number().int().min(0).optional(),
});
export async function addVideoAction(_: State, fd: FormData): Promise<State> {
  const user = await assertPermission("lessons.write");
  const p = videoSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Provide a valid https URL and provider." };
  const v = await db.video.create({ data: { ...p.data, externalId: p.data.externalId || null, status: "READY" } });
  await audit(user.id, "video.add", "Video", v.id);
  revalidatePath("/admin/courses");
  return { ok: "Video added." };
}

export async function deleteVideoAction(fd: FormData) {
  const user = await assertPermission("lessons.write");
  await db.video.delete({ where: { id: String(fd.get("id")) } });
  await audit(user.id, "video.delete", "Video", String(fd.get("id")));
  revalidatePath("/admin/courses");
}

// ---------- Quizzes ----------
export async function updateQuizAction(_: State, fd: FormData): Promise<State> {
  const user = await assertPermission("quizzes.write");
  const id = String(fd.get("id"));
  const status = z.nativeEnum(ContentStatus).parse(fd.get("status"));
  const passMark = z.coerce.number().int().min(0).max(100).parse(fd.get("passMark"));
  const maxAttempts = z.coerce.number().int().min(0).max(100).parse(fd.get("maxAttempts"));
  if (status === "PUBLISHED") {
    const qs = await db.quizQuestion.findMany({ where: { quizId: id }, include: { options: true } });
    const bad = qs.filter((q) => q.options.length < 2 || !q.options.some((o) => o.isCorrect));
    if (!qs.length || bad.length) return { error: `Cannot publish: ${!qs.length ? "no questions" : `${bad.length} question(s) need at least 2 options and one correct answer`}.` };
  }
  await db.quiz.update({ where: { id }, data: { status, passMark, maxAttempts, required: fd.get("required") === "on" } });
  await audit(user.id, "quiz.update", "Quiz", id);
  revalidatePath("/admin/quizzes");
  return { ok: "Saved." };
}

export async function saveQuestionAction(_: State, fd: FormData): Promise<State> {
  const user = await assertPermission("quizzes.write");
  const id = String(fd.get("id"));
  const prompt = String(fd.get("promptEn") ?? "").trim();
  if (!prompt) return { error: "Question text is required." };
  const optionTexts = String(fd.get("options") ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
  const correct = new Set(String(fd.get("correct") ?? "").split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => n >= 1));
  if (optionTexts.length < 2) return { error: "Add at least 2 options (one per line)." };
  if (![...correct].every((n) => n <= optionTexts.length) || !correct.size) return { error: "Correct answer numbers must refer to the options (e.g. 2 or 1,3)." };
  const q = await db.quizQuestion.findUniqueOrThrow({ where: { id } });
  await db.$transaction([
    db.quizOption.deleteMany({ where: { questionId: id } }),
    db.quizQuestion.update({
      where: { id },
      data: {
        promptEn: prompt, explanation: String(fd.get("explanation") ?? "").trim() || null,
        type: correct.size > 1 ? "MULTIPLE_CHOICE" : "SINGLE_CHOICE",
        options: { create: optionTexts.map((t, i) => ({ position: i + 1, textEn: t, isCorrect: correct.has(i + 1) })) },
      },
    }),
  ]);
  await audit(user.id, "quiz.question.save", "QuizQuestion", id);
  revalidatePath(`/admin/quizzes/${q.quizId}`);
  return { ok: "Saved." };
}

export async function addQuestionAction(fd: FormData) {
  const user = await assertPermission("quizzes.write");
  const quizId = String(fd.get("quizId"));
  const last = await db.quizQuestion.findFirst({ where: { quizId }, orderBy: { position: "desc" } });
  await db.quizQuestion.create({ data: { quizId, position: (last?.position ?? 0) + 1, promptEn: "New question" } });
  await audit(user.id, "quiz.question.add", "Quiz", quizId);
  revalidatePath(`/admin/quizzes/${quizId}`);
}

export async function deleteQuestionAction(fd: FormData) {
  const user = await assertPermission("quizzes.write");
  const q = await db.quizQuestion.delete({ where: { id: String(fd.get("id")) } });
  await audit(user.id, "quiz.question.delete", "QuizQuestion", q.id);
  revalidatePath(`/admin/quizzes/${q.quizId}`);
}

// ---------- Categories ----------
export async function saveCategoryAction(_: State, fd: FormData): Promise<State> {
  const user = await assertPermission("courses.write");
  const nameEn = String(fd.get("nameEn") ?? "").trim();
  const nameAr = String(fd.get("nameAr") ?? "").trim();
  if (!nameEn || !nameAr) return { error: "English and Arabic names are required." };
  const id = String(fd.get("id") ?? "");
  const sortOrder = parseInt(String(fd.get("sortOrder") ?? "0"), 10) || 0;
  const c = id
    ? await db.courseCategory.update({ where: { id }, data: { nameEn, nameAr, sortOrder } })
    : await db.courseCategory.create({ data: { slug: slugify(nameEn) || `cat-${Date.now()}`, nameEn, nameAr, sortOrder } });
  await audit(user.id, id ? "category.update" : "category.create", "CourseCategory", c.id);
  revalidatePath("/admin/categories");
  return { ok: "Saved." };
}

// ---------- Users / roles / enrollments / certificates ----------
export async function setUserStatusAction(fd: FormData) {
  const user = await assertPermission("users.write");
  const id = String(fd.get("id"));
  const status = z.enum(["ACTIVE", "SUSPENDED", "DISABLED"]).parse(fd.get("status"));
  if (id === user.id) throw new Error("You cannot change your own status.");
  const target = await db.user.findUniqueOrThrow({ where: { id }, include: { roles: { include: { role: true } } } });
  if (target.roles.some((r) => r.role.key === "SUPER_ADMIN") && !user.roles.includes("SUPER_ADMIN")) throw new Error("Forbidden");
  await db.user.update({ where: { id }, data: { status } });
  if (status !== "ACTIVE") await db.session.deleteMany({ where: { userId: id } });
  await audit(user.id, "user.status", "User", id, { status });
  revalidatePath("/admin/users");
}

export async function setUserRoleAction(fd: FormData) {
  const actor = await assertPermission("roles.write"); // SUPER_ADMIN only: prevents privilege escalation by ADMIN
  const userId = String(fd.get("userId"));
  const roleKey = String(fd.get("role"));
  const op = String(fd.get("op"));
  const role = await db.role.findUniqueOrThrow({ where: { key: roleKey } });
  if (userId === actor.id && roleKey === "SUPER_ADMIN" && op === "remove") throw new Error("You cannot remove your own super admin role.");
  if (op === "add") await db.userRole.upsert({ where: { userId_roleId: { userId, roleId: role.id } }, update: {}, create: { userId, roleId: role.id } });
  else await db.userRole.deleteMany({ where: { userId, roleId: role.id } });
  if (roleKey === "INSTRUCTOR" && op === "add") await db.instructorProfile.upsert({ where: { userId }, update: {}, create: { userId } });
  await db.session.deleteMany({ where: { userId, NOT: { userId: actor.id } } }); // force re-login so permissions refresh
  await audit(actor.id, `user.role.${op}`, "User", userId, { role: roleKey });
  revalidatePath("/admin/users");
}

export async function cancelEnrollmentAction(fd: FormData) {
  const user = await assertPermission("enrollments.write");
  const id = String(fd.get("id"));
  await db.enrollment.update({ where: { id }, data: { status: "CANCELLED" } });
  await audit(user.id, "enrollment.cancel", "Enrollment", id);
  revalidatePath("/admin/enrollments");
}

export async function revokeCertificateAction(fd: FormData) {
  const user = await assertPermission("certificates.write");
  const id = String(fd.get("id"));
  const restore = fd.get("restore") === "1";
  await db.certificate.update({ where: { id }, data: { revokedAt: restore ? null : new Date() } });
  await audit(user.id, restore ? "certificate.restore" : "certificate.revoke", "Certificate", id);
  revalidatePath("/admin/certificates");
}

// ---------- Settings / notifications ----------
export async function saveSettingsAction(_: State, fd: FormData): Promise<State> {
  const user = await assertPermission("settings.write");
  const set = (key: string, value: unknown) => db.systemSetting.upsert({ where: { key }, update: { value: value as never }, create: { key, value: value as never } });
  await Promise.all([
    set("brand.subtitle", { en: String(fd.get("subtitleEn") ?? "").slice(0, 200), ar: String(fd.get("subtitleAr") ?? "").slice(0, 200) }),
    set("contact.email", String(fd.get("contactEmail") ?? "").slice(0, 200)),
    set("certificate.issuer", { en: String(fd.get("issuerEn") ?? "").slice(0, 200), ar: String(fd.get("issuerAr") ?? "").slice(0, 200) }),
  ]);
  await audit(user.id, "settings.update", "SystemSetting");
  revalidatePath("/", "layout");
  return { ok: "Settings saved." };
}

export async function broadcastAction(_: State, fd: FormData): Promise<State> {
  const user = await assertPermission("settings.write");
  const title = String(fd.get("title") ?? "").trim().slice(0, 200);
  const body = String(fd.get("body") ?? "").trim().slice(0, 1000);
  const courseId = String(fd.get("courseId") ?? "");
  if (!title) return { error: "Title is required." };
  const users = await db.user.findMany({
    where: { status: "ACTIVE", deletedAt: null, ...(courseId ? { enrollments: { some: { courseId, status: { not: "CANCELLED" } } } } : { roles: { some: { role: { key: "STUDENT" } } } }) },
    select: { id: true, email: true, firstName: true },
  });
  await db.notification.createMany({ data: users.map((u) => ({ userId: u.id, type: "announcement", title, body })) });
  if (courseId) {
    const course = await db.course.findUnique({ where: { id: courseId } });
    for (const u of users) void sendMail(u.email, "course_update", { name: u.firstName, course: course?.titleEn ?? title, url: `${process.env.APP_URL ?? ""}/courses/${course?.slug ?? ""}` });
  }
  await audit(user.id, "notification.broadcast", "Notification", undefined, { recipients: users.length });
  return { ok: `Sent to ${users.length} learner(s).` };
}
