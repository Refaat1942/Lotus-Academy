// Pure parsers for the Lotus course source format (Markdown). No I/O here.
// Source layout per course folder (see content/courses-src/_FORMAT.md):
//   course-overview.md / course-overview.ar.md
//   lesson-NN-slug.md / lesson-NN-slug.ar.md / lesson-NN-slug.video.md
//   final-exam.md / final-exam.ar.md

export interface ParsedQuestion {
  position: number;
  prompt: string;
  options: { text: string; isCorrect: boolean }[];
}

export interface ParsedLesson {
  code: string | null;
  titleEn: string;
  titleAr: string | null;
  durationMinutes: number;
  prerequisites: string | null;
  objectives: string[];
  bodyMd: string;
  questions: ParsedQuestion[];
}

export interface ParsedOverview {
  code: string | null;
  titleEn: string;
  titleAr: string | null;
  durationMinutes: number;
  passMark: number;
  language: string | null;
  description: string;
  outcomes: string[];
  lessonFiles: string[];
}

const stripBold = (s: string) => s.replace(/\*\*/g, "").trim();

const H_OBJECTIVES = /Learning objectives|أهداف التعلم/i;
const H_QUIZ = /(Lesson Quiz|Final Exam|اختبار الدرس|الاختبار النهائي)/i;
const H_DESCRIPTION = /Course description|وصف الدورة/i;
const H_OUTCOMES = /Learning outcomes|مخرجات التعلم/i;
const H_INDEX = /Lesson index/i;

/** Returns the lines of a "## Heading" section (without the heading). */
function section(md: string, heading: RegExp): string | null {
  const lines = md.split("\n");
  const start = lines.findIndex((l) => /^##\s/.test(l) && heading.test(l));
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i]) || /^---\s*$/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end).join("\n").trim();
}

function listItems(block: string | null): string[] {
  if (!block) return [];
  return block
    .split("\n")
    .map((l) => l.match(/^\s*(?:\d+\.|[-*])\s+(.*)$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => m[1].trim());
}

function metaValue(head: string, label: RegExp): string | null {
  // Handles "| **Label** | value |" in either 2-col or 4-col rows.
  const re = new RegExp(`\\|\\s*\\**\\s*${label.source}\\s*\\**\\s*\\|\\s*([^|]*?)\\s*\\|`, "i");
  const m = head.match(re);
  return m ? stripBold(m[1]) : null;
}

function minutes(v: string | null): number {
  if (!v) return 0;
  const n = parseInt(v.match(/\d+/)?.[0] ?? "0", 10);
  return /hour/i.test(v) ? n * 60 : n;
}

const stripLessonPrefix = (t: string) => t.replace(/^#\s+/, "").replace(/^(Lesson|الدرس)\s+[\d.]+\s*[:：]\s*/i, "").trim();

export function parseOverview(md: string): ParsedOverview {
  const h1 = md.split("\n").filter((l) => /^#\s/.test(l));
  const titleEn = (h1[0] ?? "").replace(/^#\s+/, "").replace(/^Course\s+\d+\s+Overview:\s*/i, "").trim();
  const titleAr = h1[1] ? h1[1].replace(/^#\s+/, "").replace(/^نظرة عامة\s*[—-]\s*/, "").trim() : null;
  const head = md.slice(0, md.search(/\n##\s/) > 0 ? md.search(/\n##\s/) : md.length);
  const index = section(md, H_INDEX) ?? "";
  const lessonFiles = [...index.matchAll(/\|\s*\d+\s*\|\s*(lesson-[\w-]+\.md)\s*\|/g)].map((m) => m[1]);
  return {
    code: metaValue(head, /Course ID/),
    titleEn,
    titleAr,
    durationMinutes: minutes(metaValue(head, /Duration/)),
    passMark: parseInt(metaValue(head, /Pass mark/)?.match(/\d+/)?.[0] ?? "70", 10),
    language: metaValue(head, /Language/),
    description: section(md, H_DESCRIPTION) ?? "",
    outcomes: listItems(section(md, H_OUTCOMES)),
    lessonFiles,
  };
}

/** Arabic overview (course-overview.ar.md): title, description and outcomes. */
export function parseOverviewAr(md: string) {
  const h1 = md.split("\n").find((l) => /^#\s/.test(l)) ?? "";
  return {
    title: h1.replace(/^#\s+/, "").replace(/^نظرة عامة\s*[—-]\s*/, "").trim(),
    description: section(md, H_DESCRIPTION) ?? "",
    outcomes: listItems(section(md, H_OUTCOMES)),
  };
}

export function parseQuiz(block: string): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];
  let cur: ParsedQuestion | null = null;
  for (const line of block.split("\n")) {
    const q = line.match(/^\*\*(?:Q|س)(\d+)\.\*\*\s*(.*)$/);
    if (q) {
      cur = { position: questions.length + 1, prompt: q[2].trim(), options: [] };
      questions.push(cur);
      continue;
    }
    const o = line.match(/^\s*[-*]\s+(?:[a-eA-E]|[أبجدهـ])\)\s*(.*)$/);
    if (o && cur) {
      const raw = o[1].trim();
      const isCorrect = /✓|✔/.test(raw);
      cur.options.push({ text: raw.replace(/\s*[✓✔]\s*$/, "").trim(), isCorrect });
    }
  }
  return questions;
}

/** Extracts the questions of a lesson quiz / final exam document. */
export function parseExam(md: string): ParsedQuestion[] {
  const m = md.match(new RegExp(`^##\\s+${H_QUIZ.source}[^\\n]*\\n([\\s\\S]*?)(?=^##\\s|(?![\\s\\S]))`, "mi"));
  return m ? parseQuiz(m[2]) : [];
}

export function parseLesson(md: string): ParsedLesson {
  const lines = md.split("\n");
  const h1 = lines.filter((l) => /^#\s/.test(l));
  const titleEn = stripLessonPrefix(h1[0] ?? "");
  const titleAr = h1[1] ? stripLessonPrefix(h1[1]) : null;
  const firstH2 = lines.findIndex((l) => /^##\s/.test(l));
  const head = lines.slice(0, firstH2 === -1 ? lines.length : firstH2).join("\n");

  const objectives = listItems(section(md, H_OBJECTIVES));
  const questions = parseExam(md);

  // Body = everything after the header block, minus objectives, quiz and the "Next" footer.
  let body = lines.slice(firstH2 === -1 ? lines.length : firstH2).join("\n");
  body = body.replace(new RegExp(`^##\\s+${H_OBJECTIVES.source}[\\s\\S]*?(?=^##\\s)`, "mi"), "");
  body = body.replace(new RegExp(`^##\\s+${H_QUIZ.source}[\\s\\S]*?(?=^##\\s|(?![\\s\\S]))`, "mi"), "");
  body = body.replace(/^\*Next:.*\*\s*$/gm, "");
  body = body.replace(/^---\s*$/gm, "").replace(/\n{3,}/g, "\n\n").trim();

  return {
    code: metaValue(head, /Lesson ID/),
    titleEn,
    titleAr,
    durationMinutes: minutes(metaValue(head, /Duration/)),
    prerequisites: metaValue(head, /Prerequisites/),
    objectives,
    bodyMd: body,
    questions,
  };
}

/** Video production scripts: "## English" and "## العربية" sections (admin-only reference). */
export function parseVideoScript(md: string): { en: string | null; ar: string | null } {
  return { en: section(md, /English\s*$/i)?.trim() || null, ar: section(md, /العربية\s*$/)?.trim() || null };
}

/** A quiz question is usable only if it has >= 2 options and at least one marked correct. */
export function isUsableQuestion(q: ParsedQuestion): boolean {
  return q.options.length >= 2 && q.options.filter((o) => o.isCorrect).length >= 1;
}
