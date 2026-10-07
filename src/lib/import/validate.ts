import fs from "fs";
import path from "path";
import { parseExam, parseLesson, parseOverview, parseOverviewAr, parseVideoScript } from "./parse";

const words = (s: string) => (s.match(/[\p{L}\p{N}]+/gu) ?? []).length;
// Names that cannot be confused with ordinary Arabic/English words (ambiguous ones such as عمر "age", علي, نور, حسن, هدى are deliberately excluded).
const AR_NAMES = "أحمد|محمد|محمود|مصطفى|سارة|فاطمة|خالد|يوسف|هاني|سمير|طارق|رانيا|عمرو|مريم|ليلى";
const EN_NAMES = "Ahmed|Ahmad|Mohamed|Mohammed|Muhammad|Mahmoud|Mostafa|Mustafa|Sara|Sarah|Fatma|Fatima|Mona|Hassan|Hussein|Mariam|Maryam|Omar|Khaled|Youssef|Yusuf|Hany|Hoda|Samir|Amr|Tarek|Layla|Laila|Salma|Heba|Dina|Rania|John|Mary|David|Michael";
// A title is only suspicious when followed by an actual name (Latin capitalised word or a known Arabic name); "د." must be a standalone token.
const NAME_HINTS = new RegExp(`\\b(?:Dr|Mr|Mrs|Ms|Prof)\\.?\\s+[A-Z][a-z]+|(?<![\\p{L}])د\\.\\s+(?:${AR_NAMES}|[A-Za-z]{2,})|(?:الدكتور|الدكتورة|السيد|السيدة|الأستاذ|الاستاذ|الأستاذة)\\s+(?:${AR_NAMES})(?![\\p{L}])`, "u");
const COMMON_NAMES = new RegExp(`\\b(?:${EN_NAMES})\\b|(?<![\\p{L}])(?:${AR_NAMES})(?![\\p{L}])`, "u");

export interface ValidationResult { errors: string[]; warnings: string[]; stats: { lessons: number; questions: number; words: number } }

/** Validates a course source folder against the Lotus authoring format. */
export function validateCourseDir(dir: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const stats = { lessons: 0, questions: 0, words: 0 };
  const read = (f: string) => (fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), "utf8") : null);
  const err = (m: string) => errors.push(m);

  const ovEn = read("course-overview.md");
  const ovAr = read("course-overview.ar.md");
  if (!ovEn) return { errors: ["missing course-overview.md"], warnings, stats };
  if (!ovAr) err("missing course-overview.ar.md");
  const ov = parseOverview(ovEn);
  if (!ov.code || !/^EG-[A-Z]+-\d\d$/.test(ov.code)) err(`course ID must look like EG-XXX-NN (got ${ov.code})`);
  if (!ov.durationMinutes) err("overview Duration missing");
  if (ov.description.length < 150) err("English course description too short");
  if (ov.outcomes.length < 4) err("need at least 4 learning outcomes");
  if (ovAr) {
    const a = parseOverviewAr(ovAr);
    if (!a.title) err("Arabic overview title missing");
    if (a.description.length < 100) err("Arabic course description too short");
    if (a.outcomes.length !== ov.outcomes.length) err(`Arabic outcomes (${a.outcomes.length}) must match English (${ov.outcomes.length})`);
    if (!/[؀-ۿ]/.test(a.description)) err("Arabic overview contains no Arabic text");
  }

  const lessonFiles = fs.readdirSync(dir).filter((f) => /^lesson-[\w-]+\.md$/.test(f) && !/\.(ar|video)\.md$/.test(f)).sort();
  if (ov.lessonFiles.length !== lessonFiles.length) err(`Lesson index lists ${ov.lessonFiles.length} files but ${lessonFiles.length} lesson files exist`);
  for (const f of ov.lessonFiles) if (!lessonFiles.includes(f)) err(`indexed lesson file not found: ${f}`);
  if (lessonFiles.length < 4) err("a course needs at least 4 lessons");

  for (const f of lessonFiles) {
    const base = f.replace(/\.md$/, "");
    const en = read(f)!;
    const ar = read(`${base}.ar.md`);
    const vid = read(`${base}.video.md`);
    const L = parseLesson(en);
    stats.lessons++;
    if (!L.code || !L.code.startsWith(ov.code ?? "~")) err(`${f}: Lesson ID missing or does not start with the course ID`);
    if (!L.durationMinutes) err(`${f}: Duration missing`);
    if (!L.titleAr) err(`${f}: second H1 (Arabic title) missing`);
    if (L.objectives.length < 3) err(`${f}: need at least 3 learning objectives`);
    const w = words(L.bodyMd);
    stats.words += w;
    if (w < 350) err(`${f}: English body too short (${w} words, min 350)`);
    if (!/^##\s+Key takeaways/im.test(L.bodyMd)) err(`${f}: missing "## Key takeaways"`);
    checkQuiz(f, L.questions, 10);
    if (!ar) err(`${base}.ar.md missing`);
    else {
      const A = parseLesson(ar);
      if (!A.titleEn) err(`${base}.ar.md: Arabic H1 title missing`);
      if (!/[؀-ۿ]/.test(A.bodyMd)) err(`${base}.ar.md: no Arabic text in body`);
      if (A.objectives.length !== L.objectives.length) err(`${base}.ar.md: objectives (${A.objectives.length}) must match English (${L.objectives.length})`);
      const aw = words(A.bodyMd);
      stats.words += aw;
      if (aw < 250) err(`${base}.ar.md: Arabic body too short (${aw} words, min 250)`);
      if (!/^##\s+(أهم النقاط|النقاط الرئيسية)/m.test(A.bodyMd)) err(`${base}.ar.md: missing "## أهم النقاط" section`);
      checkQuiz(`${base}.ar.md`, A.questions, 10);
      if (A.questions.length === L.questions.length)
        A.questions.forEach((q, i) => {
          const a = L.questions[i].options.findIndex((o) => o.isCorrect), b = q.options.findIndex((o) => o.isCorrect);
          if (a !== b) err(`${base}.ar.md Q${i + 1}: correct option position differs from English`);
        });
    }
    if (!vid) err(`${base}.video.md missing`);
    else {
      const v = parseVideoScript(vid);
      if (!v.en || words(v.en) < 120) err(`${base}.video.md: English script missing or under 120 words`);
      if (!v.ar || words(v.ar) < 100) err(`${base}.video.md: Arabic script missing or under 100 words`);
    }
    for (const [name, text] of [[f, en], [`${base}.ar.md`, ar ?? ""], [`${base}.video.md`, vid ?? ""]] as const) scanText(name, text);
  }

  const fe = read("final-exam.md"), fa = read("final-exam.ar.md");
  if (!fe) err("final-exam.md missing");
  if (!fa) err("final-exam.ar.md missing");
  if (fe) {
    const q = parseExam(fe);
    checkQuiz("final-exam.md", q, 20);
    if (fa) {
      const qa = parseExam(fa);
      checkQuiz("final-exam.ar.md", qa, 20);
      qa.forEach((x, i) => { if (q[i] && q[i].options.findIndex((o) => o.isCorrect) !== x.options.findIndex((o) => o.isCorrect)) err(`final-exam.ar.md Q${i + 1}: correct option position differs from English`); });
    }
    scanText("final-exam.md", fe);
  }
  if (fa) scanText("final-exam.ar.md", fa);
  stats.questions = lessonFiles.length * 10 + 20;

  function checkQuiz(name: string, qs: ReturnType<typeof parseExam>, expected: number) {
    if (qs.length !== expected) err(`${name}: expected ${expected} questions, found ${qs.length}`);
    qs.forEach((q, i) => {
      if (q.options.length !== 4) err(`${name} Q${i + 1}: needs exactly 4 options (found ${q.options.length})`);
      if (q.options.filter((o) => o.isCorrect).length !== 1) err(`${name} Q${i + 1}: needs exactly one ✓ option`);
      if (q.prompt.length < 10) err(`${name} Q${i + 1}: question text too short`);
    });
    const letters = qs.map((q) => q.options.findIndex((o) => o.isCorrect));
    if (qs.length >= 8 && new Set(letters).size < 3) warnings.push(`${name}: correct answers are not varied across positions (${letters.join(",")})`);
  }
  function scanText(name: string, text: string) {
    if (!text) return;
    if (NAME_HINTS.test(text)) err(`${name}: looks like it mentions a person's name/title (use roles instead)`);
    const m = text.match(COMMON_NAMES);
    if (m) err(`${name}: contains the personal name "${m[0]}" (use roles like "the customer" instead)`);
    if (/<script|javascript:|<iframe/i.test(text)) err(`${name}: contains active HTML`);
    if (/(\+?20|0)1[0125]\d{8}|[\w.]+@[\w.]+\.\w+/.test(text)) err(`${name}: contains a phone number or email address`);
    const before = text.split(/^##\s+(?:Lesson Quiz|Final Exam|اختبار الدرس|الاختبار النهائي)/m)[0];
    if (/[✓✔]/.test(before)) err(`${name}: ✓ marks must only appear inside the quiz section`);
  }
  return { errors, warnings, stats };
}
