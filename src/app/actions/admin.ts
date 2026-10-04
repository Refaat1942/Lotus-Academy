"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertPermission, type CurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { ContentStatus, CourseLevel } from "@prisma/client";
import { sendMail } from "@/lib/mail";
import { validateBrandUpload } from "@/lib/brand";
import { safeFileName, validateMaterial } from "@/lib/materials";

type State = { error?: string; ok?: string } | null;
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

/** Instructors may only touch courses they are assigned to; admins/content managers may touch all. */
async function assertCourseAccess(user: CurrentUser, courseId: string) {
  if (["SUPER_ADMIN", "ADMIN", "CONTENT_MANAGER"].some((r) => user.roles.includes(r))) return;
  const link = await db.courseInstructor.findUnique({ where: { courseId_instructorId: { courseId, instructorId: user.id } } });
  if (!link) throw new Error("Forbidden");
}
const isManager = (u: CurrentUser) => ["SUPER_ADMIN", "ADMIN", "CONTENT_MANAGER"].some((r) => u.roles.includes(r));
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
  sequential: z.string().optional(),
  thumbnailUrl: z.string().trim().max(500).refine((v) => !v || /^(https:\/\/|\/(?![\/\\]))/.test(v), "Thumbnail must be an https URL or a /path").optional(),
});

export async function createCourseAction(_: State, fd: FormData): Promise<State> {
  const user = await assertPermission("courses.write");
  const title = String(fd.get("titleEn") ?? "").trim();
  if (title.length < 2) return { error: "Title is required." };
  const level = z.nativeEnum(CourseLevel).catch("INTERMEDIATE").parse(fd.get("level"));
  const categoryId = String(fd.get("categoryId") ?? "") || null;
  let slug = slugify(title) || "course";
  if (await db.course.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
  const c = await db.course.create({
    data: {
      slug, titleEn: title, titleAr: String(fd.get("titleAr") ?? "").trim() || null, level, categoryId, status: "DRAFT",
      modules: { create: { position: 1, titleEn: "Getting started", titleAr: "البداية" } },
    },
  });
  if (!isManager(user)) await db.courseInstructor.create({ data: { courseId: c.id, instructorId: (await db.instructorProfile.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } })).userId } });
  await audit(user.id, "course.create", "Course", c.id);
  redirect(`/admin/courses/${c.id}`);
}

export async function updateCourseAction(_: State, fd: FormData): Promise<State> {
  const user = await assertPermission("courses.write");
  const id = String(fd.get("id"));
  await assertCourseAccess(user, id);
  const p = courseSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const d = p.data;
  await db.course.update({
    where: { id },
    data: {
      titleEn: d.titleEn, titleAr: d.titleAr || null, summaryEn: d.summaryEn || null, summaryAr: d.summaryAr || null,
      descriptionEn: d.descriptionEn || null, descriptionAr: d.descriptionAr || null,
      objectivesEn: lines(d.objectivesEn ?? ""), objectivesAr: lines(d.objectivesAr ?? ""), prerequisitesEn: d.prerequisitesEn || null,
      categoryId: d.categoryId || null, sequential: d.sequential === "on", level: d.level, durationMinutes: d.durationMinutes, passMark: d.passMark, thumbnailUrl: d.thumbnailUrl || null,
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
  await assertCourseAccess(user, id);
  await db.course.update({ where: { id }, data: { status, publishedAt: status === "PUBLISHED" ? new Date() : undefined } });
  await audit(user.id, `course.${status.toLowerCase()}`, "Course", id);
  revalidatePath("/admin/courses");
  revalidatePath("/courses");
}

export async function assignInstructorAction(_: State, fd: FormData): Promise<State> {
  const user = await assertPermission("courses.write");
  if (!isManager(user)) throw new Error("Forbidden");
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
  if (!isManager(user)) throw new Error("Forbidden");
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
  requireCheckpoint: z.string().optional(),
});

export async function updateLessonAction(_: State, fd: FormData): Promise<State> {
  const user = await assertPermission("lessons.write");
  const id = String(fd.get("id"));
  const p = lessonSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const d = p.data;
  if (d.status === "PUBLISHED") await assertPermission("courses.publish");
  await assertCourseAccess(user, (await db.lesson.findUniqueOrThrow({ where: { id } })).courseId);
  const lesson = await db.lesson.update({
    where: { id },
    data: { titleEn: d.titleEn, titleAr: d.titleAr || null, bodyMd: d.bodyMd, durationMinutes: d.durationMinutes, objectives: lines(d.objectives ?? ""), status: d.status, isPreview: d.isPreview === "on", requireCheckpoint: d.requireCheckpoint === "on", searchText: `${d.titleEn} ${d.bodyMd}`.slice(0, 20000) },
  });
  await audit(user.id, "lesson.update", "Lesson", id);
  revalidatePath(`/admin/courses/${lesson.courseId}`);
  return { ok: "Saved." };
}

/** Re-numbers lessons 1..N following module order, keeping the learner path consistent. */
async function normalizeOrder(courseId: string) {
  const mods = await db.courseModule.findMany({ where: { courseId }, orderBy: { position: "asc" }, include: { lessons: { where: { deletedAt: null }, orderBy: { position: "asc" }, select: { id: true } } } });
  let n = 0;
  const ops = mods.flatMap((m) => m.lessons.map((l) => db.lesson.update({ where: { id: l.id }, data: { position: ++n } })));
  if (ops.length) await db.$transaction(ops);
}

export async function createLessonAction(fd: FormData) {
  const user = await assertPermission("lessons.write");
  const courseId = String(fd.get("courseId"));
  await assertCourseAccess(user, courseId);
  const wanted = String(fd.get("moduleId") ?? "");
  const mod = (wanted && (await db.courseModule.findFirst({ where: { id: wanted, courseId } }))) || (await db.courseModule.findFirstOrThrow({ where: { courseId }, orderBy: { position: "asc" } }));
  const l = await db.lesson.create({ data: { courseId, moduleId: mod.id, slug: `lesson-${Date.now().toString(36)}`, titleEn: "New lesson", position: 100000, status: "DRAFT" } });
  await normalizeOrder(courseId);
  await audit(user.id, "lesson.create", "Lesson", l.id);
  redirect(`/admin/courses/${courseId}/lessons/${l.id}`);
}

// ---------- Pathway designer: modules ----------
export async function addModuleAction(fd: FormData) {
  const user = await assertPermission("lessons.write");
  const courseId = String(fd.get("courseId"));
  await assertCourseAccess(user, courseId);
  const last = await db.courseModule.findFirst({ where: { courseId }, orderBy: { position: "desc" } });
  const m = await db.courseModule.create({ data: { courseId, position: (last?.position ?? 0) + 1, titleEn: "New module" } });
  await audit(user.id, "module.create", "CourseModule", m.id);
  revalidatePath(`/admin/courses/${courseId}`);
}

export async function updateModuleAction(_: State, fd: FormData): Promise<State> {
  const user = await assertPermission("lessons.write");
  const id = String(fd.get("id"));
  const m = await db.courseModule.findUniqueOrThrow({ where: { id } });
  await assertCourseAccess(user, m.courseId);
  const titleEn = String(fd.get("titleEn") ?? "").trim();
  if (!titleEn) return { error: "Module title is required." };
  await db.courseModule.update({ where: { id }, data: { titleEn: titleEn.slice(0, 200), titleAr: String(fd.get("titleAr") ?? "").trim().slice(0, 200) || null, descriptionEn: String(fd.get("descriptionEn") ?? "").trim().slice(0, 600) || null, descriptionAr: String(fd.get("descriptionAr") ?? "").trim().slice(0, 600) || null } });
  await audit(user.id, "module.update", "CourseModule", id);
  revalidatePath(`/admin/courses/${m.courseId}`);
  return { ok: "Saved." };
}

export async function moveModuleAction(fd: FormData) {
  const user = await assertPermission("lessons.write");
  const m = await db.courseModule.findUniqueOrThrow({ where: { id: String(fd.get("id")) } });
  await assertCourseAccess(user, m.courseId);
  const up = fd.get("dir") === "up";
  const other = await db.courseModule.findFirst({ where: { courseId: m.courseId, position: up ? { lt: m.position } : { gt: m.position } }, orderBy: { position: up ? "desc" : "asc" } });
  if (!other) return;
  await db.$transaction([
    db.courseModule.update({ where: { id: m.id }, data: { position: -1 } }),
    db.courseModule.update({ where: { id: other.id }, data: { position: m.position } }),
    db.courseModule.update({ where: { id: m.id }, data: { position: other.position } }),
  ]);
  await normalizeOrder(m.courseId);
  await audit(user.id, "module.reorder", "CourseModule", m.id);
  revalidatePath(`/admin/courses/${m.courseId}`);
}

export async function deleteModuleAction(fd: FormData) {
  const user = await assertPermission("lessons.write");
  const m = await db.courseModule.findUniqueOrThrow({ where: { id: String(fd.get("id")) }, include: { _count: { select: { lessons: { where: { deletedAt: null } } } } } });
  await assertCourseAccess(user, m.courseId);
  if (m._count.lessons) throw new Error("Move or archive the lessons first.");
  if ((await db.courseModule.count({ where: { courseId: m.courseId } })) <= 1) throw new Error("A course needs at least one module.");
  await db.courseModule.delete({ where: { id: m.id } });
  await audit(user.id, "module.delete", "CourseModule", m.id);
  revalidatePath(`/admin/courses/${m.courseId}`);
}

export async function setLessonModuleAction(fd: FormData) {
  const user = await assertPermission("lessons.write");
  const l = await db.lesson.findUniqueOrThrow({ where: { id: String(fd.get("id")) } });
  await assertCourseAccess(user, l.courseId);
  const target = await db.courseModule.findFirst({ where: { id: String(fd.get("moduleId")), courseId: l.courseId } });
  if (!target || target.id === l.moduleId) return;
  await db.lesson.update({ where: { id: l.id }, data: { moduleId: target.id, position: 100000 } });
  await normalizeOrder(l.courseId);
  await audit(user.id, "lesson.move_module", "Lesson", l.id, { module: target.id });
  revalidatePath(`/admin/courses/${l.courseId}`);
}

// ---------- Materials (links and files) ----------
export async function addMaterialLinkAction(_: State, fd: FormData): Promise<State> {
  const user = await assertPermission("lessons.write");
  const lessonId = String(fd.get("lessonId"));
  const lesson = await db.lesson.findUniqueOrThrow({ where: { id: lessonId } });
  await assertCourseAccess(user, lesson.courseId);
  const name = String(fd.get("name") ?? "").trim().slice(0, 150);
  const url = String(fd.get("url") ?? "").trim();
  if (!name || !/^https:\/\/[^\s]+$/.test(url)) return { error: "Provide a title and a valid https link." };
  await db.lessonAsset.create({ data: { lessonId, kind: "LINK", name, url } });
  await audit(user.id, "material.link", "Lesson", lessonId);
  revalidatePath(`/admin/courses/${lesson.courseId}`);
  return { ok: "Link added." };
}

export async function uploadMaterialAction(_: State, fd: FormData): Promise<State> {
  const user = await assertPermission("lessons.write");
  const lessonId = String(fd.get("lessonId"));
  const lesson = await db.lesson.findUniqueOrThrow({ where: { id: lessonId } });
  await assertCourseAccess(user, lesson.courseId);
  const file = fd.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Choose a file." };
  const buf = Buffer.from(await file.arrayBuffer());
  const v = validateMaterial(buf, file.name);
  if (!v.ok) return { error: v.error };
  const name = String(fd.get("name") ?? "").trim().slice(0, 150) || file.name.slice(0, 150);
  const stored = await db.storedFile.create({ data: { name: safeFileName(file.name), mime: v.mime, data: new Uint8Array(buf), sizeBytes: buf.length } });
  await db.lessonAsset.create({ data: { lessonId, kind: "FILE", name, fileId: stored.id, url: "", mimeType: v.mime, sizeBytes: buf.length } });
  await audit(user.id, "material.upload", "Lesson", lessonId, { mime: v.mime, bytes: buf.length });
  revalidatePath(`/admin/courses/${lesson.courseId}`);
  return { ok: `Uploaded (${Math.round(buf.length / 1024)} KB).` };
}

export async function deleteMaterialAction(fd: FormData) {
  const user = await assertPermission("lessons.write");
  const a = await db.lessonAsset.findUniqueOrThrow({ where: { id: String(fd.get("id")) }, include: { lesson: true } });
  await assertCourseAccess(user, a.lesson.courseId);
  await db.lessonAsset.delete({ where: { id: a.id } });
  if (a.fileId) await db.storedFile.deleteMany({ where: { id: a.fileId } });
  await audit(user.id, "material.delete", "Lesson", a.lessonId);
  revalidatePath(`/admin/courses/${a.lesson.courseId}`);
}

// ---------- Course cover ----------
export async function uploadCourseCoverAction(_: State, fd: FormData): Promise<State> {
  const user = await assertPermission("courses.write");
  const courseId = String(fd.get("courseId"));
  await assertCourseAccess(user, courseId);
  const file = fd.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Choose an image." };
  const buf = Buffer.from(await file.arrayBuffer());
  const v = validateBrandUpload(buf);
  if (!v.ok) return { error: v.error };
  const key = `course-${courseId}`;
  const data = new Uint8Array(buf);
  await db.brandAsset.upsert({ where: { key }, update: { mime: v.mime, data, sizeBytes: buf.length, fileName: file.name.slice(0, 200) }, create: { key, mime: v.mime, data, sizeBytes: buf.length, fileName: file.name.slice(0, 200) } });
  await db.course.update({ where: { id: courseId }, data: { thumbnailUrl: `/api/brand/${key}?v=${Date.now()}` } });
  await audit(user.id, "course.cover", "Course", courseId);
  revalidatePath("/", "layout");
  return { ok: "Cover updated." };
}

export async function removeCourseCoverAction(fd: FormData) {
  const user = await assertPermission("courses.write");
  const courseId = String(fd.get("courseId"));
  await assertCourseAccess(user, courseId);
  await db.brandAsset.deleteMany({ where: { key: `course-${courseId}` } });
  await db.course.update({ where: { id: courseId }, data: { thumbnailUrl: null } });
  revalidatePath("/", "layout");
}

/** Moves a lesson up/down inside its module by swapping positions (module order never changes). */
export async function moveLessonAction(fd: FormData) {
  const user = await assertPermission("lessons.write");
  const id = String(fd.get("id"));
  const dir = fd.get("dir") === "up" ? -1 : 1;
  const l = await db.lesson.findUniqueOrThrow({ where: { id } });
  await assertCourseAccess(user, l.courseId);
  const other = await db.lesson.findFirst({ where: { moduleId: l.moduleId, deletedAt: null, position: dir === -1 ? { lt: l.position } : { gt: l.position } }, orderBy: { position: dir === -1 ? "desc" : "asc" } });
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
  const target = await db.lesson.findUniqueOrThrow({ where: { id: String(fd.get("id")) } });
  await assertCourseAccess(user, target.courseId);
  const l = await db.lesson.update({ where: { id: target.id }, data: { status: "ARCHIVED", deletedAt: new Date() } });
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
  await assertCourseAccess(user, (await db.lesson.findUniqueOrThrow({ where: { id: p.data.lessonId } })).courseId);
  const v = await db.video.create({ data: { ...p.data, externalId: p.data.externalId || null, status: "READY" } });
  await audit(user.id, "video.add", "Video", v.id);
  revalidatePath("/admin/courses");
  return { ok: "Video added." };
}

export async function deleteVideoAction(fd: FormData) {
  const user = await assertPermission("lessons.write");
  const vid = await db.video.findUniqueOrThrow({ where: { id: String(fd.get("id")) }, include: { lesson: true } });
  await assertCourseAccess(user, vid.lesson.courseId);
  await db.video.delete({ where: { id: vid.id } });
  await audit(user.id, "video.delete", "Video", String(fd.get("id")));
  revalidatePath("/admin/courses");
}

// ---------- Quizzes ----------
async function assertQuizAccess(user: CurrentUser, quizId: string) {
  await assertCourseAccess(user, (await db.quiz.findUniqueOrThrow({ where: { id: quizId } })).courseId);
}

export async function updateQuizAction(_: State, fd: FormData): Promise<State> {
  const user = await assertPermission("quizzes.write");
  const id = String(fd.get("id"));
  const status = z.nativeEnum(ContentStatus).parse(fd.get("status"));
  if (status === "PUBLISHED") await assertPermission("courses.publish");
  await assertQuizAccess(user, id);
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
  await assertQuizAccess(user, q.quizId);
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
  await assertQuizAccess(user, quizId);
  const last = await db.quizQuestion.findFirst({ where: { quizId }, orderBy: { position: "desc" } });
  await db.quizQuestion.create({ data: { quizId, position: (last?.position ?? 0) + 1, promptEn: "New question" } });
  await audit(user.id, "quiz.question.add", "Quiz", quizId);
  revalidatePath(`/admin/quizzes/${quizId}`);
}

export async function deleteQuestionAction(fd: FormData) {
  const user = await assertPermission("quizzes.write");
  const qq = await db.quizQuestion.findUniqueOrThrow({ where: { id: String(fd.get("id")) } });
  await assertQuizAccess(user, qq.quizId);
  const q = await db.quizQuestion.delete({ where: { id: qq.id } });
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
  if (status !== "ACTIVE") await db.$transaction([db.session.deleteMany({ where: { userId: id } }), db.authToken.deleteMany({ where: { userId: id } })]);
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

// ---------- Brand assets ----------
export async function uploadBrandAction(_: State, fd: FormData): Promise<State> {
  const user = await assertPermission("settings.write");
  const slot = String(fd.get("slot"));
  if (slot !== "logo" && slot !== "favicon") return { error: "Unknown slot." };
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image file." };
  const buf = Buffer.from(await file.arrayBuffer());
  const v = validateBrandUpload(buf);
  if (!v.ok) return { error: v.error };
  const data = new Uint8Array(buf);
  await db.brandAsset.upsert({
    where: { key: slot },
    update: { mime: v.mime, data, sizeBytes: buf.length, fileName: file.name.slice(0, 200) },
    create: { key: slot, mime: v.mime, data, sizeBytes: buf.length, fileName: file.name.slice(0, 200) },
  });
  await audit(user.id, "brand.upload", "BrandAsset", slot, { mime: v.mime, bytes: buf.length });
  revalidatePath("/", "layout");
  return { ok: `${slot === "logo" ? "Logo" : "Favicon"} updated (${v.mime}, ${Math.round(buf.length / 1024)} KB).` };
}

export async function removeBrandAction(fd: FormData) {
  const user = await assertPermission("settings.write");
  const slot = String(fd.get("slot"));
  await db.brandAsset.deleteMany({ where: { key: slot } });
  await audit(user.id, "brand.remove", "BrandAsset", slot);
  revalidatePath("/", "layout");
}
