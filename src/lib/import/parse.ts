// Pure parsers for the Lotus course source format (Markdown). No I/O here.

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

export function parseOverview(md: string): ParsedOverview {
  const h1 = md.split("\n").filter((l) => /^#\s/.test(l));
  const titleEn = (h1[0] ?? "").replace(/^#\s+/, "").replace(/^Course\s+\d+\s+Overview:\s*/i, "").trim();
  const titleAr = h1[1] ? h1[1].replace(/^#\s+/, "").replace(/^نظرة عامة\s*[—-]\s*/, "").trim() : null;
  const head = md.slice(0, md.search(/\n##\s/) > 0 ? md.search(/\n##\s/) : md.length);
  const index = section(md, /Lesson index/i) ?? "";
  const lessonFiles = [...index.matchAll(/\|\s*\d+\s*\|\s*(lesson-[\w-]+\.md)\s*\|/g)].map((m) => m[1]);
  return {
    code: metaValue(head, /Course ID/),
    titleEn,
    titleAr,
    durationMinutes: minutes(metaValue(head, /Duration/)),
    passMark: parseInt(metaValue(head, /Pass mark/)?.match(/\d+/)?.[0] ?? "70", 10),
    language: metaValue(head, /Language/),
    description: section(md, /Course description/i) ?? "",
    outcomes: listItems(section(md, /Learning outcomes/i)),
    lessonFiles,
  };
}

export function parseQuiz(block: string): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];
  let cur: ParsedQuestion | null = null;
  for (const line of block.split("\n")) {
    const q = line.match(/^\*\*Q(\d+)\.\*\*\s*(.*)$/);
    if (q) {
      cur = { position: questions.length + 1, prompt: q[2].trim(), options: [] };
      questions.push(cur);
      continue;
    }
    const o = line.match(/^\s*[-*]\s+[a-eA-E]\)\s*(.*)$/);
    if (o && cur) {
      const raw = o[1].trim();
      const isCorrect = /✓|✔/.test(raw);
      cur.options.push({ text: raw.replace(/\s*[✓✔]\s*$/, "").trim(), isCorrect });
    }
  }
  return questions;
}

export function parseLesson(md: string): ParsedLesson {
  const lines = md.split("\n");
  const h1 = lines.filter((l) => /^#\s/.test(l));
  const titleEn = (h1[0] ?? "").replace(/^#\s+/, "").replace(/^Lesson\s+[\d.]+:\s*/i, "").trim();
  const titleAr = h1[1] ? h1[1].replace(/^#\s+/, "").replace(/^الدرس\s+[\d.]+:\s*/, "").trim() : null;
  const firstH2 = lines.findIndex((l) => /^##\s/.test(l));
  const head = lines.slice(0, firstH2 === -1 ? lines.length : firstH2).join("\n");

  const objectives = listItems(section(md, /Learning objectives/i));
  const quizMatch = md.match(/^##\s+Lesson Quiz[^\n]*\n([\s\S]*?)(?=^##\s|(?![\s\S]))/m);
  const questions = quizMatch ? parseQuiz(quizMatch[1]) : [];

  // Body = everything after the header block, minus objectives, quiz and the "Next" footer.
  let body = lines.slice(firstH2 === -1 ? lines.length : firstH2).join("\n");
  body = body.replace(/^##\s+Learning objectives[\s\S]*?(?=^##\s)/m, "");
  body = body.replace(/^##\s+Lesson Quiz[\s\S]*?(?=^##\s|(?![\s\S]))/m, "");
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

/** A quiz question is usable only if it has >= 2 options and exactly one marked correct (single choice). */
export function isUsableQuestion(q: ParsedQuestion): boolean {
  return q.options.length >= 2 && q.options.filter((o) => o.isCorrect).length >= 1;
}
