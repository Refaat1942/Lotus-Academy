// Audits every course: lessons, quizzes, final exam, Arabic coverage and assessment quality.
// Usage: npx tsx scripts/audit-courses.ts [--json]
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const courses = await db.course.findMany({
    where: { deletedAt: null },
    orderBy: { sortOrder: "asc" },
    include: {
      lessons: { where: { deletedAt: null }, orderBy: { position: "asc" }, include: { quizzes: { include: { questions: { include: { options: true } } } }, videos: true } },
      quizzes: { where: { lessonId: null }, include: { questions: { include: { options: true } } } },
    },
  });
  const rows = [];
  for (const c of courses) {
    const issues: string[] = [];
    const L = c.lessons.filter((l) => l.status === "PUBLISHED");
    let qTotal = 0, qBad = 0, quizPub = 0, quizDraft = 0, noQuiz = 0, cpWeak = 0, arBody = 0, arQ = 0;
    for (const l of L) {
      if (l.bodyMdAr) arBody++;
      const q = l.quizzes[0];
      if (!q) { noQuiz++; continue; }
      q.status === "PUBLISHED" ? quizPub++ : quizDraft++;
      for (const x of q.questions) {
        qTotal++;
        if (x.options.length < 4 || x.options.filter((o) => o.isCorrect).length !== 1) qBad++;
        if (x.promptAr) arQ++;
      }
      if (q.status === "PUBLISHED" && q.drawCount > 0 && q.questions.length < q.drawCount) cpWeak++;
    }
    const fin = c.quizzes[0];
    if (!fin) issues.push("no final exam");
    else if (fin.status !== "PUBLISHED") issues.push("final exam is DRAFT");
    if (quizDraft) issues.push(`${quizDraft}/${L.length} lesson quizzes are DRAFT (questions have no wrong options)`);
    if (qBad) issues.push(`${qBad}/${qTotal} questions lack 4 options or a single correct answer`);
    if (cpWeak) issues.push(`${cpWeak} lesson quizzes have fewer questions than they serve per attempt`);
    if (noQuiz) issues.push(`${noQuiz} lessons have no quiz`);
    if (arBody < L.length) issues.push(`Arabic lesson text: ${arBody}/${L.length}`);
    if (qTotal && arQ < qTotal) issues.push(`Arabic questions: ${arQ}/${qTotal}`);
    const reqQuizzes = quizPub + (fin?.status === "PUBLISHED" ? 1 : 0);
    rows.push({ code: c.code, title: c.titleEn, status: c.status, lessons: L.length, questions: qTotal, requiredExams: reqQuizzes, lessonsGatedByQuiz: quizPub, finalExam: fin ? `${fin.drawCount || fin.questions.length} q / ${fin.maxAttempts || "∞"} attempts` : "none", issues });
  }
  if (process.argv.includes("--json")) console.log(JSON.stringify(rows, null, 2));
  else for (const r of rows) console.log(`${r.issues.length ? "✗" : "✓"} ${r.code} ${r.title} [${r.status}] lessons=${r.lessons} questions=${r.questions} gatedLessons=${r.lessonsGatedByQuiz} final=${r.finalExam}\n${r.issues.map((i) => "    - " + i).join("\n")}`);
}
main().finally(() => db.$disconnect());
