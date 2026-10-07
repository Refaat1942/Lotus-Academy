import fs from "fs";
import os from "os";
import path from "path";
import AdmZip from "adm-zip";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { importArchives } from "@/lib/import/run";

const qs = (ar: boolean, n: number) => Array.from({ length: n }, (_, i) =>
  `**Q${i + 1}.** ${ar ? `سؤال رقم ${i + 1}؟` : `Question number ${i + 1}?`}\n- a) ${ar ? "خيار أ" : "Option A"}\n- b) ${ar ? "خيار ب" : "Option B"} ✓\n- c) ${ar ? "خيار ج" : "Option C"}\n- d) ${ar ? "خيار د" : "Option D"}\n`).join("\n");

const files: Record<string, string> = {
  "course-overview.md": `# Course 99 Overview: Bilingual Test\n# نظرة عامة — دورة تجريبية\n\n| Field | Value |\n|---|---|\n| **Course ID** | EG-TST-99 |\n| **Total lessons** | 1 |\n| **Duration** | 2 hours |\n| **Pass mark** | 70% |\n\n## Course description\n\nAn English description.\n\n## Learning outcomes\n\n1. Do one thing\n\n## Lesson index\n\n| # | File | Topic |\n|---|---|---|\n| 1 | lesson-01-intro.md | Intro |\n`,
  "course-overview.ar.md": `# نظرة عامة — دورة تجريبية\n\n## وصف الدورة\n\nوصف عربي للدورة.\n\n## مخرجات التعلم\n\n1. افعل شيئًا واحدًا\n`,
  "lesson-01-intro.md": `# Lesson 1.1: Intro\n# الدرس 1.1: مقدمة\n\n| | |\n|---|---|\n| **Duration** | 60 minutes |\n| **Lesson ID** | EG-TST-99-L01 |\n\n---\n\n## Learning objectives\n\n1. Learn it\n\n## 1. Body\n\nEnglish body text.\n\n## Key takeaways\n\n- one\n\n---\n\n## Lesson Quiz (6 questions)\n\n${qs(false, 6)}`,
  "lesson-01-intro.ar.md": `# الدرس 1.1: مقدمة\n\n## أهداف التعلم\n\n1. تعلّمه\n\n## 1. المحتوى\n\nنص عربي للدرس.\n\n## أهم النقاط\n\n- واحد\n\n## اختبار الدرس (6 أسئلة)\n\n${qs(true, 6)}`,
  "lesson-01-intro.video.md": `## English\n\nNarration in English.\n\n## العربية\n\nسرد بالعربية.\n`,
  "final-exam.md": `# Final Exam — Bilingual Test\n\n## Final Exam (6 questions)\n\n${qs(false, 6)}`,
  "final-exam.ar.md": `# الاختبار النهائي — دورة تجريبية\n\n## الاختبار النهائي (6 أسئلة)\n\n${qs(true, 6)}`,
};

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bil-"));
const zip = new AdmZip();
for (const [n, c] of Object.entries(files)) zip.addFile(`courses/99-test-bilingual/${n}`, Buffer.from(c));
zip.writeZip(path.join(dir, "Course-99-test-bilingual.zip"));

afterAll(async () => { await db.course.deleteMany({ where: { code: "EG-TST-99" } }); });

describe("bilingual course import", () => {
  it("imports Arabic content, video scripts, quizzes and the final exam; re-import is a no-op", async () => {
    const r = await importArchives(db, dir);
    expect(r.courses[0]).toMatchObject({ code: "EG-TST-99", action: "created", lessons: 1 });
    const c = await db.course.findUniqueOrThrow({ where: { code: "EG-TST-99" }, include: { lessons: { include: { quizzes: { include: { questions: { include: { options: true }, orderBy: { position: "asc" } } } } } }, quizzes: { include: { questions: true } } } });
    expect(c.titleAr).toBe("دورة تجريبية");
    expect(c.descriptionAr).toBe("وصف عربي للدورة.");
    expect(c.objectivesAr).toEqual(["افعل شيئًا واحدًا"]);
    const l = c.lessons[0];
    expect(l.bodyMdAr).toContain("نص عربي للدرس");
    expect(l.bodyMd).toContain("English body text");
    expect(l.bodyMd).not.toContain("Lesson Quiz");
    expect(l.objectivesAr).toEqual(["تعلّمه"]);
    expect(l.videoScriptEn).toBe("Narration in English.");
    expect(l.videoScriptAr).toBe("سرد بالعربية.");
    const q = l.quizzes[0].questions[0];
    expect(q.promptAr).toBe("سؤال رقم 1؟");
    expect(q.options.map((o) => o.textAr)).toEqual(["خيار أ", "خيار ب", "خيار ج", "خيار د"]);
    expect(q.options.findIndex((o) => o.isCorrect)).toBe(1);
    const exam = c.quizzes.find((x) => x.lessonId === null)!;
    expect(exam).toMatchObject({ titleEn: "Final exam", status: "PUBLISHED", required: true });
    expect(exam.questions).toHaveLength(6);
    const again = await importArchives(db, dir);
    expect(again.courses[0].action).toBe("unchanged");
    expect(await db.quiz.count({ where: { courseId: c.id, lessonId: null } })).toBe(1);
  });
});
