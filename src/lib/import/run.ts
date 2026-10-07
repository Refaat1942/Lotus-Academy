import crypto from "crypto";
import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { ContentStatus, Prisma, PrismaClient, QuestionType } from "@prisma/client";
import { isUsableQuestion, parseExam, parseLesson, parseOverview, parseOverviewAr, parseVideoScript, ParsedLesson, ParsedQuestion } from "./parse";

const MAX_ENTRY_BYTES = 2 * 1024 * 1024;
const MAX_ENTRIES = 500;
const MIN_PUBLISHABLE_QUESTIONS = 5;

const CATEGORY_BY_FOLDER: Record<string, { slug: string; nameEn: string; nameAr: string; order: number }> = {
  cardiovascular: { slug: "cardiovascular", nameEn: "Cardiovascular", nameAr: "القلب والأوعية الدموية", order: 1 },
  antimicrobials: { slug: "infectious-diseases", nameEn: "Infectious Diseases", nameAr: "الأمراض المعدية", order: 2 },
  diabetes: { slug: "endocrinology", nameEn: "Endocrinology & Diabetes", nameAr: "الغدد الصماء والسكري", order: 3 },
  "cns-analgesics": { slug: "neuroscience-pain", nameEn: "Neuroscience & Pain", nameAr: "الأعصاب والمسكنات", order: 4 },
  "gi-respiratory": { slug: "gi-respiratory", nameEn: "GI & Respiratory", nameAr: "الجهاز الهضمي والتنفسي", order: 5 },
  pediatrics: { slug: "pediatrics", nameEn: "Pediatrics", nameAr: "طب الأطفال", order: 6 },
  "womens-health": { slug: "womens-health", nameEn: "Women's Health", nameAr: "صحة المرأة", order: 7 },
  "selling-skills": { slug: "retail-excellence", nameEn: "Retail Excellence", nameAr: "التميز في التجزئة", order: 8 },
  "customer-experience": { slug: "retail-excellence", nameEn: "Retail Excellence", nameAr: "التميز في التجزئة", order: 8 },
  "retail-operations": { slug: "retail-excellence", nameEn: "Retail Excellence", nameAr: "التميز في التجزئة", order: 8 },
  "communication-skills": { slug: "professional-skills", nameEn: "Professional Skills", nameAr: "المهارات المهنية", order: 9 },
  "dermocosmetics-skin-care-1": { slug: "dermocosmetics", nameEn: "Dermocosmetics", nameAr: "مستحضرات التجميل الطبية", order: 10 },
  "dermocosmetics-skin-care-2": { slug: "dermocosmetics", nameEn: "Dermocosmetics", nameAr: "مستحضرات التجميل الطبية", order: 10 },
  "hair-scalp-care": { slug: "hair-scalp-care", nameEn: "Hair & Scalp Care", nameAr: "العناية بالشعر وفروة الرأس", order: 11 },
};

export interface ArchiveRecord {
  fileName: string;
  sha256: string;
  contentHash: string;
  courseCode: string | null;
  folder: string | null;
  isDuplicate: boolean;
  duplicateOf: string | null;
  files: Map<string, Buffer>;
}

export interface ImportReport {
  archives: { fileName: string; sha256: string; courseCode: string | null; duplicate: boolean; duplicateOf: string | null }[];
  courses: { code: string; slug: string; action: "created" | "updated" | "unchanged"; lessons: number; quizzesPublished: number; quizzesDraft: number }[];
  warnings: string[];
  totals: { archives: number; uniqueCourses: number; duplicates: number; lessons: number; questions: number; usableQuestions: number };
}

const sha = (b: Buffer | string) => crypto.createHash("sha256").update(b).digest("hex");

/** Reads a ZIP fully in memory. Entries are never written to disk, and unsafe paths are rejected. */
export function readArchive(filePath: string): ArchiveRecord {
  const buf = fs.readFileSync(filePath);
  const zip = new AdmZip(buf);
  const entries = zip.getEntries();
  if (entries.length > MAX_ENTRIES) throw new Error(`${filePath}: too many entries`);
  const files = new Map<string, Buffer>();
  for (const e of entries) {
    if (e.isDirectory) continue;
    const name = e.rawEntryName.toString("utf8").replace(/\\/g, "/");
    if (name.startsWith("/") || name.split("/").includes("..") || /^[a-zA-Z]:/.test(name)) {
      throw new Error(`${filePath}: unsafe entry path "${name}"`);
    }
    if (e.header.size > MAX_ENTRY_BYTES) throw new Error(`${filePath}: entry too large "${name}"`);
    if (!name.endsWith(".md")) continue; // only Markdown is accepted as source content
    files.set(name, e.getData());
  }
  // Content hash covers only the canonical course tree (not the redundant full-curriculum export).
  const canon = [...files.entries()]
    .filter(([n]) => n.startsWith("courses/"))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([n, d]) => `${n.replace(/^courses\/[^/]+\//, "")}:${sha(d)}`)
    .join("\n");
  const folder = [...files.keys()].map((n) => n.match(/^courses\/([^/]+)\//)?.[1]).find(Boolean) ?? null;
  const overview = folder ? files.get(`courses/${folder}/course-overview.md`) : undefined;
  const courseCode = overview ? parseOverview(overview.toString("utf8")).code : null;
  return {
    fileName: path.basename(filePath),
    sha256: sha(buf),
    contentHash: sha(canon),
    courseCode,
    folder,
    isDuplicate: false,
    duplicateOf: null,
    files,
  };
}

/** Marks later archives that repeat an earlier byte-identical or content-identical package. */
export function detectDuplicates(archives: ArchiveRecord[]) {
  const seenSha = new Map<string, string>();
  const seenContent = new Map<string, string>();
  for (const a of archives) {
    const dup = seenSha.get(a.sha256) ?? seenContent.get(a.contentHash);
    if (dup) {
      a.isDuplicate = true;
      a.duplicateOf = dup;
    } else {
      seenSha.set(a.sha256, a.fileName);
      seenContent.set(a.contentHash, a.fileName);
    }
  }
}

const slugify = (s: string) =>
  s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export async function importArchives(db: PrismaClient, dir: string): Promise<ImportReport> {
  const zips = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".zip")).sort();
  const archives = zips.map((z) => readArchive(path.join(dir, z)));
  detectDuplicates(archives);

  const report: ImportReport = {
    archives: archives.map((a) => ({ fileName: a.fileName, sha256: a.sha256, courseCode: a.courseCode, duplicate: a.isDuplicate, duplicateOf: a.duplicateOf })),
    courses: [],
    warnings: [],
    totals: { archives: archives.length, uniqueCourses: 0, duplicates: 0, lessons: 0, questions: 0, usableQuestions: 0 },
  };

  const seenCodes = new Set<string>();
  for (const a of archives) {
    if (a.isDuplicate) {
      report.totals.duplicates++;
      report.warnings.push(`Duplicate archive skipped: ${a.fileName} (same as ${a.duplicateOf})`);
      continue;
    }
    if (!a.folder || !a.courseCode) {
      report.warnings.push(`Skipped ${a.fileName}: no recognisable course structure`);
      continue;
    }
    if (seenCodes.has(a.courseCode)) {
      report.warnings.push(`Skipped ${a.fileName}: course ${a.courseCode} already imported from another archive`);
      continue;
    }
    seenCodes.add(a.courseCode);
    await importCourse(db, a, report);
  }
  report.totals.uniqueCourses = report.courses.length;

  const batch = await db.importBatch.create({
    data: {
      status: report.warnings.length ? "COMPLETED_WITH_WARNINGS" : "COMPLETED",
      report: report as unknown as Prisma.InputJsonValue,
      archives: {
        create: archives.map((a) => ({
          fileName: a.fileName,
          sha256: a.sha256,
          contentHash: a.contentHash,
          isDuplicate: a.isDuplicate,
          duplicateOf: a.duplicateOf,
          courseCode: a.courseCode,
        })),
      },
    },
  });
  void batch;
  return report;
}

async function importCourse(db: PrismaClient, a: ArchiveRecord, report: ImportReport) {
  const folder = a.folder!;
  const base = `courses/${folder}`;
  const overviewSrc = a.files.get(`${base}/course-overview.md`)!.toString("utf8");
  const ov = parseOverview(overviewSrc);
  const folderSlug = folder.replace(/^\d+-/, "");
  const cat = CATEGORY_BY_FOLDER[folderSlug];
  const slug = slugify(ov.titleEn) || folderSlug;

  // Lessons live in "<base>/lessons/" (older archives) or directly in "<base>/" (bilingual format).
  const isLessonFile = (n: string) => n.startsWith(`${base}/`) && /(^|\/)lesson-[\w-]+\.md$/.test(n) && !/\.(ar|video)\.md$/.test(n);
  const lessonPaths = [...a.files.keys()].filter(isLessonFile).sort();
  const parsed: { file: string; path: string; hash: string; lesson: ParsedLesson; ar: ParsedLesson | null; video: { en: string | null; ar: string | null } | null }[] = lessonPaths.map((p) => {
    const raw = a.files.get(p)!;
    const arRaw = a.files.get(p.replace(/\.md$/, ".ar.md"));
    const vidRaw = a.files.get(p.replace(/\.md$/, ".video.md"));
    return {
      file: path.basename(p), path: p, hash: sha(raw), lesson: parseLesson(raw.toString("utf8")),
      ar: arRaw ? parseLesson(arRaw.toString("utf8")) : null,
      video: vidRaw ? parseVideoScript(vidRaw.toString("utf8")) : null,
    };
  });
  const arOvRaw = a.files.get(`${base}/course-overview.ar.md`);
  const arOv = arOvRaw ? parseOverviewAr(arOvRaw.toString("utf8")) : null;
  const finalEn = a.files.get(`${base}/final-exam.md`);
  const finalAr = a.files.get(`${base}/final-exam.ar.md`);
  const finalQs: ParsedQuestion[] = finalEn ? parseExam(finalEn.toString("utf8")) : [];
  const finalArQs: ParsedQuestion[] = finalAr ? parseExam(finalAr.toString("utf8")) : [];
  // Use the overview's lesson index for ordering when it is complete, else file name order.
  const order = ov.lessonFiles.length === parsed.length ? ov.lessonFiles : parsed.map((p) => p.file);
  parsed.sort((x, y) => order.indexOf(x.file) - order.indexOf(y.file));

  for (const p of parsed) {
    if (!p.lesson.code) report.warnings.push(`${a.fileName}/${p.file}: missing Lesson ID`);
    if (!p.lesson.objectives.length) report.warnings.push(`${a.fileName}/${p.file}: no learning objectives found`);
  }

  // The hash covers every source file of the course (EN/AR lessons, video scripts, exams), so any edit re-imports it.
  const courseHash = sha([...a.files.entries()].filter(([n]) => n.startsWith(`${base}/`)).sort(([x], [y]) => x.localeCompare(y)).map(([n, d]) => `${n}:${sha(d)}`).join("\n"));
  const existing = await db.course.findUnique({ where: { code: ov.code! } });
  const unchanged = existing?.sourceHash === courseHash;

  let quizzesPublished = 0;
  let quizzesDraft = 0;
  let qTotal = 0;
  let qUsable = 0;
  for (const p of parsed) {
    qTotal += p.lesson.questions.length;
    qUsable += p.lesson.questions.filter(isUsableQuestion).length;
  }
  report.totals.lessons += parsed.length;
  report.totals.questions += qTotal;
  report.totals.usableQuestions += qUsable;

  if (unchanged) {
    report.courses.push({ code: ov.code!, slug: existing!.slug, action: "unchanged", lessons: parsed.length, quizzesPublished: 0, quizzesDraft: 0 });
    return;
  }

  await db.$transaction(
    async (tx) => {
      const category = cat
        ? await tx.courseCategory.upsert({
            where: { slug: cat.slug },
            update: {},
            create: { slug: cat.slug, nameEn: cat.nameEn, nameAr: cat.nameAr, sortOrder: cat.order },
          })
        : null;

      const courseData = {
        slug: existing?.slug ?? slug,
        titleEn: ov.titleEn,
        titleAr: arOv?.title || ov.titleAr,
        summaryEn: ov.description.split(/(?<=\.)\s/)[0] ?? null,
        summaryAr: arOv?.description ? arOv.description.split(/(?<=[.؟!])\s/)[0] : null,
        descriptionEn: ov.description,
        descriptionAr: arOv?.description || null,
        objectivesEn: ov.outcomes,
        objectivesAr: arOv?.outcomes ?? [],
        durationMinutes: ov.durationMinutes,
        passMark: ov.passMark,
        language: ov.language,
        categoryId: category?.id ?? null,
        sortOrder: parseInt(folder.slice(0, 2), 10),
        sourceArchive: a.fileName,
        sourcePath: base,
        sourceHash: courseHash,
        importedAt: new Date(),
      };
      const course = existing
        ? await tx.course.update({ where: { id: existing.id }, data: courseData })
        : await tx.course.create({ data: { ...courseData, code: ov.code!, status: ContentStatus.PUBLISHED, publishedAt: new Date() } });

      let mod = await tx.courseModule.findFirst({ where: { courseId: course.id, position: 1 } });
      if (!mod) mod = await tx.courseModule.create({ data: { courseId: course.id, position: 1, titleEn: "Course lessons", titleAr: "دروس الدورة" } });

      let pos = 0;
      for (const p of parsed) {
        pos++;
        const l = p.lesson;
        const lessonSlug = p.file.replace(/\.md$/, "");
        const lessonData = {
          titleEn: l.titleEn,
          titleAr: p.ar?.titleEn || l.titleAr,
          bodyMd: l.bodyMd,
          bodyMdAr: p.ar?.bodyMd ?? null,
          objectivesAr: p.ar?.objectives ?? [],
          videoScriptEn: p.video?.en ?? null,
          videoScriptAr: p.video?.ar ?? null,
          objectives: l.objectives,
          prerequisites: l.prerequisites,
          durationMinutes: l.durationMinutes,
          searchText: `${l.titleEn} ${l.bodyMd}`.slice(0, 20000),
          sourceArchive: a.fileName,
          sourcePath: p.path,
          sourceHash: p.hash,
          importedAt: new Date(),
        };
        const code = l.code ?? `${ov.code}-${lessonSlug}`;
        // Park position to avoid unique-collision during re-ordering, then set it.
        const lesson = await tx.lesson.upsert({
          where: { code },
          update: { ...lessonData, position: 1000 + pos, moduleId: mod.id },
          create: { ...lessonData, code, courseId: course.id, moduleId: mod.id, slug: lessonSlug, position: 1000 + pos, status: ContentStatus.PUBLISHED, isPreview: pos === 1 },
        });
        await tx.lesson.update({ where: { id: lesson.id }, data: { position: pos } });

        if (l.questions.length) {
          const withAr = l.questions.map((q, i) => ({ q, ar: p.ar && p.ar.questions.length === l.questions.length && p.ar.questions[i].options.length === q.options.length ? p.ar.questions[i] : undefined }));
          if (p.ar && p.ar.questions.length && !withAr.some((x) => x.ar)) report.warnings.push(`${ov.code}: "${l.titleEn}" Arabic quiz does not match the English structure; Arabic quiz text skipped`);
          const usable = withAr.filter((x) => isUsableQuestion(x.q));
          const publish = usable.length >= MIN_PUBLISHABLE_QUESTIONS;
          const qs = publish ? usable : withAr;
          const status = publish ? ContentStatus.PUBLISHED : ContentStatus.DRAFT;
          if (publish) quizzesPublished++;
          else {
            quizzesDraft++;
            report.warnings.push(`${ov.code}: lesson "${l.titleEn}" quiz kept as DRAFT (${usable.length}/${l.questions.length} questions have distractor options)`);
          }
          const quiz = await tx.quiz.upsert({
            where: { lessonId: lesson.id },
            update: { titleEn: `${l.titleEn} — Quiz`, titleAr: p.ar?.titleEn ? `${p.ar.titleEn} — اختبار` : null, passMark: ov.passMark, status },
            create: { courseId: course.id, lessonId: lesson.id, titleEn: `${l.titleEn} — Quiz`, titleAr: p.ar?.titleEn ? `${p.ar.titleEn} — اختبار` : null, passMark: ov.passMark, status },
          });
          await tx.quizQuestion.deleteMany({ where: { quizId: quiz.id } });
          await createQuestions(tx, quiz.id, qs);
        }
      }

      // Final exam (course-level quiz, required for completion)
      if (finalQs.length) {
        const fx = finalQs.map((q, i) => ({ q, ar: finalArQs.length === finalQs.length && finalArQs[i].options.length === q.options.length ? finalArQs[i] : undefined }));
        const usableFinal = fx.filter((x) => isUsableQuestion(x.q));
        const status = usableFinal.length >= MIN_PUBLISHABLE_QUESTIONS ? ContentStatus.PUBLISHED : ContentStatus.DRAFT;
        const existingFinal = await tx.quiz.findFirst({ where: { courseId: course.id, lessonId: null } });
        const data = { titleEn: "Final exam", titleAr: "الاختبار النهائي", passMark: ov.passMark, status, required: true };
        const quiz = existingFinal ? await tx.quiz.update({ where: { id: existingFinal.id }, data }) : await tx.quiz.create({ data: { ...data, courseId: course.id } });
        await tx.quizQuestion.deleteMany({ where: { quizId: quiz.id } });
        await createQuestions(tx, quiz.id, status === ContentStatus.PUBLISHED ? usableFinal : fx);
        if (status === ContentStatus.PUBLISHED) quizzesPublished++; else quizzesDraft++;
      }
      // Remove lessons no longer present in the source (only those that came from this import).
      const codes = parsed.map((p) => p.lesson.code ?? `${ov.code}-${p.file.replace(/\.md$/, "")}`);
      await tx.lesson.updateMany({
        where: { courseId: course.id, sourceArchive: { not: null }, code: { notIn: codes }, deletedAt: null },
        data: { deletedAt: new Date(), status: ContentStatus.ARCHIVED },
      });
    },
    { timeout: 60000 },
  );

  report.courses.push({ code: ov.code!, slug: existing?.slug ?? slug, action: existing ? "updated" : "created", lessons: parsed.length, quizzesPublished, quizzesDraft });
}

type Tx = Prisma.TransactionClient;
async function createQuestions(tx: Tx, quizId: string, qs: { q: ParsedQuestion; ar?: ParsedQuestion }[]) {
  let qp = 0;
  for (const { q, ar } of qs) {
    qp++;
    const isTF = q.options.length === 2 && q.options.every((o) => /^(true|false)$/i.test(o.text));
    await tx.quizQuestion.create({
      data: {
        quizId,
        position: qp,
        promptEn: q.prompt,
        promptAr: ar?.prompt ?? null,
        type: isTF ? QuestionType.TRUE_FALSE : q.options.filter((o) => o.isCorrect).length > 1 ? QuestionType.MULTIPLE_CHOICE : QuestionType.SINGLE_CHOICE,
        options: { create: q.options.map((o, i) => ({ position: i + 1, textEn: o.text, textAr: ar?.options[i]?.text ?? null, isCorrect: o.isCorrect })) },
      },
    });
  }
}
