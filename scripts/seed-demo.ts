// Demo data for presentations: fictional branches, areas, staff, progress, quiz answers, certificates and cases.
//   npm run seed:demo             → (re)creates the demo
//   npm run seed:demo -- --remove → deletes every demo account and restores the settings it changed
// All demo accounts use the reserved domain @demo.invalid (emails to it are never sent).
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const DOMAIN = "demo.invalid";
const PASSWORD = process.env.DEMO_PASSWORD ?? "LotusDemo#2026";
const DAY = 86400_000;
const now = new Date();
const ago = (d: number) => new Date(now.getTime() - d * DAY);

// ---------- deterministic randomness ----------
let seed = 20261109;
const rand = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pickOne = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const shuffled = <T,>(xs: T[]) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- fictional organisation ----------
const AREAS: Record<string, string[]> = {
  "Cairo West": ["Zamalek", "Mohandessin", "Dokki", "Sheikh Zayed"],
  "Cairo East": ["Heliopolis", "Nasr City", "Maadi", "New Cairo"],
  Alexandria: ["Smouha", "Gleem", "Sidi Gaber"],
  Delta: ["Mansoura", "Tanta"],
};
const FIRST = ["Ahmed", "Mohamed", "Mahmoud", "Omar", "Youssef", "Karim", "Mostafa", "Hassan", "Tarek", "Amr", "Khaled", "Sherif", "Hany", "Islam", "Mina", "Bishoy",
  "Mariam", "Nour", "Salma", "Yasmin", "Aya", "Dina", "Rana", "Heba", "Reem", "Sara", "Nada", "Mai", "Shaimaa", "Marwa", "Esraa", "Christine", "Habiba", "Farida"];
const LAST = ["Hassan", "Mostafa", "Fathy", "El-Sayed", "Abdelrahman", "Saleh", "Kamal", "Nabil", "Farouk", "Gaber", "Mansour", "Ragab", "Shawky", "Zaki", "Hamdy",
  "Lotfy", "Naguib", "Wahba", "Girgis", "Habib", "Attia", "Soliman", "Badawy", "Rizk", "Sabry", "Fouad", "Helmy", "Morsy", "Osman", "Tawfik"];
// Branch "personalities" make the analytics look realistic (some branches strong, some need support).
const BRANCH_SKILL: Record<string, number> = { Zamalek: 1.06, Heliopolis: 1.08, Smouha: 1.02, "New Cairo": 1.04, Mansoura: 0.86, Tanta: 0.9, Gleem: 0.93, "Nasr City": 0.95 };
const BRANCH_DRIVE: Record<string, number> = { Zamalek: 0.85, Heliopolis: 0.9, Mansoura: 0.35, Tanta: 0.45, Dokki: 0.55, "Sidi Gaber": 0.5 };

type Manifest = { courseAudiences: [string, string][]; validity: { courseId: string; prev: number | null }[]; paths: string[] };

async function remove() {
  const users = await db.user.findMany({ where: { email: { endsWith: `@${DOMAIN}` } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await db.certificate.deleteMany({ where: { userId: { in: ids } } });
    await db.reminderLog.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
  }
  const m = await db.systemSetting.findUnique({ where: { key: "demo.manifest" } });
  if (m) {
    const man = m.value as unknown as Manifest;
    for (const [courseId, audienceId] of man.courseAudiences) await db.courseAudience.deleteMany({ where: { courseId, audienceId } });
    for (const v of man.validity) await db.course.updateMany({ where: { id: v.courseId }, data: { validityMonths: v.prev } });
    await db.learningPath.deleteMany({ where: { id: { in: man.paths } } });
    await db.systemSetting.delete({ where: { key: "demo.manifest" } });
  }
  console.log(`Removed ${ids.length} demo accounts and restored demo settings.`);
}

interface Q { id: string; options: { id: string; isCorrect: boolean }[] }
/** Demo-only certificate validity (simulates a 12-month renewal policy without changing the real course). */
const DEMO_VALIDITY: Record<string, number> = { "EG-MED-02": 12 };

interface CourseData { id: string; code: string; titleEn: string; validityMonths: number | null; lessons: { id: string; quiz: { id: string; passMark: number; drawCount: number; questions: Q[] } | null }[]; final: { id: string; passMark: number; drawCount: number; questions: Q[] } | null }

async function loadCourse(code: string): Promise<CourseData | null> {
  const c = await db.course.findFirst({
    where: { code, status: "PUBLISHED", deletedAt: null },
    include: { modules: { orderBy: { position: "asc" }, include: { lessons: { where: { status: "PUBLISHED", deletedAt: null }, orderBy: { position: "asc" }, include: { quizzes: { where: { status: "PUBLISHED" }, include: { questions: { include: { options: true } } } } } } } },
      quizzes: { where: { lessonId: null, status: "PUBLISHED" }, include: { questions: { include: { options: true } } } } },
  });
  if (!c) return null;
  const qz = (q: { id: string; passMark: number; drawCount: number; questions: { id: string; options: { id: string; isCorrect: boolean }[] }[] } | undefined) => q && q.questions.length ? { id: q.id, passMark: q.passMark, drawCount: q.drawCount, questions: q.questions.map((x) => ({ id: x.id, options: x.options.map((o) => ({ id: o.id, isCorrect: o.isCorrect })) })) } : null;
  return { id: c.id, code, titleEn: c.titleEn, validityMonths: c.validityMonths, lessons: c.modules.flatMap((m) => m.lessons.map((l) => ({ id: l.id, quiz: qz(l.quizzes[0]) }))), final: qz(c.quizzes[0]) };
}

/** Probability that a learner answers a question correctly: some questions are genuinely hard. */
function pCorrect(qid: string, skill: number) {
  const h = hash(qid) % 100;
  const base = h < 12 ? 0.42 : h < 30 ? 0.66 : 0.92;
  return Math.min(0.98, base * skill);
}
/** Wrong answers cluster on one "favourite" distractor (a real misconception), as in real exams. */
function wrongOption(q: Q) {
  const wrong = q.options.filter((o) => !o.isCorrect);
  if (!wrong.length) return q.options[0];
  return rand() < 0.7 ? wrong[hash(q.id + "w") % wrong.length] : pickOne(wrong);
}

const attemptRows: Prisma.QuizAttemptCreateManyInput[] = [];
const answerRows: Prisma.QuizAnswerCreateManyInput[] = [];
let attemptSeq = 0;

function sitQuiz(userId: string, quiz: NonNullable<CourseData["final"]>, skill: number, at: Date) {
  const n = quiz.drawCount > 0 ? Math.min(quiz.drawCount, quiz.questions.length) : quiz.questions.length;
  const qs = shuffled(quiz.questions).slice(0, n);
  const id = `demo_att_${userId.slice(-6)}_${++attemptSeq}`;
  let correct = 0;
  for (const q of qs) {
    const ok = rand() < pCorrect(q.id, skill);
    const opt = ok ? q.options.find((o) => o.isCorrect)! : wrongOption(q);
    if (opt.isCorrect) correct++;
    answerRows.push({ attemptId: id, questionId: q.id, optionIds: [opt.id], isCorrect: opt.isCorrect });
  }
  const scorePct = Math.round((correct / n) * 100);
  const passed = scorePct >= quiz.passMark;
  attemptRows.push({ id, userId, quizId: quiz.id, scorePct, passed, questionIds: qs.map((q) => q.id), startedAt: at, submittedAt: new Date(at.getTime() + between(4, 15) * 60_000) });
  return passed;
}

/**
 * Simulates a learner working through a course: lesson quizzes (retrying when failed), then the final exam.
 * `target` = share of the course the learner gets through (1 = tries to finish).
 */
async function study(userId: string, c: CourseData, opts: { skill: number; target: number; start: Date; end: Date; certDate?: Date }) {
  const span = Math.max(1, opts.end.getTime() - opts.start.getTime());
  const goal = Math.round(c.lessons.length * opts.target);
  let done = 0;
  const progress: Prisma.LessonProgressCreateManyInput[] = [];
  for (const [i, l] of c.lessons.entries()) {
    if (i >= goal) break;
    const at = new Date(opts.start.getTime() + (span * (i + 0.5)) / c.lessons.length);
    let passed = !l.quiz;
    for (let a = 0; l.quiz && !passed && a < 4; a++) passed = sitQuiz(userId, l.quiz, opts.skill + a * 0.05, new Date(at.getTime() + a * 3600_000));
    progress.push({ userId, lessonId: l.id, courseId: c.id, completedAt: passed ? at : null, lastViewedAt: at });
    if (!passed) break;
    done++;
  }
  if (progress.length) await db.lessonProgress.createMany({ data: progress, skipDuplicates: true });
  let complete = false;
  if (done === c.lessons.length && c.final) {
    for (let a = 0; a < 3 && !complete; a++) complete = sitQuiz(userId, c.final, opts.skill + 0.04 * a, new Date(opts.end.getTime() - (2 - a) * 3600_000));
  }
  const percent = Math.round(((done + (complete ? 1 : 0)) / (c.lessons.length + (c.final ? 1 : 0))) * 100);
  await db.courseProgress.upsert({ where: { userId_courseId: { userId, courseId: c.id } }, update: { percent, lessonsDone: done, lessonsTotal: c.lessons.length }, create: { userId, courseId: c.id, percent, lessonsDone: done, lessonsTotal: c.lessons.length } });
  if (complete) {
    const issued = opts.certDate ?? opts.end;
    await db.enrollment.update({ where: { userId_courseId: { userId, courseId: c.id } }, data: { status: "COMPLETED", completedAt: issued } });
    const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { firstName: true, lastName: true } });
    const months = c.validityMonths ?? DEMO_VALIDITY[c.code];
    const expiresAt = months ? new Date(new Date(issued).setMonth(issued.getMonth() + months)) : null;
    const code = () => Array.from({ length: 4 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(rand() * 32)]).join("");
    await db.certificate.create({ data: { publicId: `LA-${code()}-${code()}-${code()}`, userId, courseId: c.id, recipientName: `${u.firstName} ${u.lastName}`, courseTitle: c.titleEn, issuedAt: issued, expiresAt } });
  }
  return { done, complete, percent };
}

async function main() {
  if (process.argv.includes("--remove")) return remove();
  if (await db.user.count({ where: { email: { endsWith: `@${DOMAIN}` } } })) { console.log("Existing demo found — replacing it."); await remove(); }

  const aud = Object.fromEntries((await db.audience.findMany()).map((a) => [a.key, a.id]));
  for (const k of ["PHARMACIST", "BRANCH_MANAGER", "AREA_MANAGER", "DEPARTMENT_MANAGER"]) if (!aud[k]) throw new Error(`Job role ${k} missing — run the seed first.`);
  const codes = ["EG-RET-01", "EG-RET-02", "EG-RET-03", "EG-COM-01", "EG-MED-02", "EG-MED-04", "EG-DRM-01"];
  const courses = Object.fromEntries((await Promise.all(codes.map(loadCourse))).filter(Boolean).map((c) => [c!.code, c!])) as Record<string, CourseData>;
  if (!courses["EG-RET-01"] || !courses["EG-MED-02"]) throw new Error("Import the courses first (npm run import:courses).");

  // The demo never changes course settings that would affect real staff: mandatory training is created as
  // "assigned" enrolments on demo accounts only, and the demo path is not auto-assigned.
  const manifest: Manifest = { courseAudiences: [], validity: [], paths: [] };
  const med02 = courses["EG-MED-02"];
  const path = await db.learningPath.create({ data: {
    slug: `new-pharmacist-onboarding-demo-${Date.now().toString(36)}`, titleEn: "New Pharmacist Onboarding (demo)", titleAr: "برنامج تأهيل الصيادلة الجدد (تجريبي)",
    descriptionEn: "The first 30 days at Lotus: selling with care, communication, then antimicrobial stewardship.", descriptionAr: "أول 30 يومًا في لوتس: البيع باهتمام، ثم مهارات التواصل، ثم الاستخدام الرشيد للمضادات الحيوية.",
    audienceId: aud.PHARMACIST, autoAssignNewHires: false, dueDays: 30, published: true, createdAt: ago(60),
    courses: { create: ["EG-RET-01", "EG-COM-01", "EG-MED-02"].filter((c) => courses[c]).map((c, i) => ({ courseId: courses[c].id, position: i })) },
  } });
  manifest.paths.push(path.id);
  await db.systemSetting.upsert({ where: { key: "demo.manifest" }, update: { value: manifest as unknown as Prisma.InputJsonValue }, create: { key: "demo.manifest", value: manifest as unknown as Prisma.InputJsonValue } });

  // ---------- people ----------
  const hashPw = await bcrypt.hash(PASSWORD, 12);
  const student = await db.role.findUniqueOrThrow({ where: { key: "STUDENT" } });
  const used = new Set<string>();
  const person = () => { for (;;) { const f = pickOne(FIRST), l = pickOne(LAST); if (!used.has(f + l)) { used.add(f + l); return [f, l] as const; } } };
  const mk = async (o: { email?: string; audience: string; branch?: string; area?: string; department: string; createdDaysAgo: number; lastLoginDaysAgo: number | null; name?: readonly [string, string] }) => {
    const [firstName, lastName] = o.name ?? person();
    const email = o.email ?? `${firstName}.${lastName}.${between(10, 99)}`.toLowerCase().replace(/[^a-z0-9.]/g, "") + `@${DOMAIN}`;
    return db.user.create({ data: {
      email, firstName, lastName, passwordHash: hashPw, status: "ACTIVE", emailVerifiedAt: ago(o.createdDaysAgo), createdAt: ago(o.createdDaysAgo),
      lastLoginAt: o.lastLoginDaysAgo === null ? null : ago(o.lastLoginDaysAgo), audienceId: aud[o.audience], branch: o.branch ?? null, area: o.area ?? null, department: o.department,
      roles: { create: { roleId: student.id } }, studentProfile: { create: {} },
    } });
  };
  const enrol = (userId: string, c: CourseData, enrolledAt: Date, dueDays: number | null, source = "assigned") =>
    db.enrollment.create({ data: { userId, courseId: c.id, enrolledAt, source, dueAt: dueDays ? new Date(enrolledAt.getTime() + dueDays * DAY) : null } });

  const people: { id: string; branch: string | null; skill: number; drive: number; key: string }[] = [];
  const logins: Record<string, string> = {};
  for (const [area, branches] of Object.entries(AREAS)) {
    const am = await mk({ email: area === "Cairo West" ? `area.manager@${DOMAIN}` : undefined, audience: "AREA_MANAGER", area, department: "Retail Operations", createdDaysAgo: 400, lastLoginDaysAgo: between(0, 6) });
    if (area === "Cairo West") logins["Area manager — Cairo West (4 branches)"] = am.email;
    people.push({ id: am.id, branch: null, skill: 1.05, drive: 0.8, key: "AREA_MANAGER" });
    for (const branch of branches) {
      const drive = BRANCH_DRIVE[branch] ?? 0.7, skill = BRANCH_SKILL[branch] ?? 1;
      const bm = await mk({ email: branch === "Zamalek" ? `branch.manager@${DOMAIN}` : undefined, audience: "BRANCH_MANAGER", branch, area, department: "Retail Operations", createdDaysAgo: between(200, 900), lastLoginDaysAgo: between(0, 10) });
      if (branch === "Zamalek") logins["Branch manager — Zamalek"] = bm.email;
      people.push({ id: bm.id, branch, skill: skill * 1.03, drive: Math.min(1, drive + 0.1), key: "BRANCH_MANAGER" });
      for (let i = 0, n = between(3, 5); i < n; i++) {
        const isDemo = branch === "Zamalek" && i === 0;
        const ph = await mk({ email: isDemo ? `pharmacist@${DOMAIN}` : undefined, audience: "PHARMACIST", branch, area, department: "Retail Operations", createdDaysAgo: between(90, 1200), lastLoginDaysAgo: rand() < drive ? between(0, 6) : rand() < 0.5 ? between(8, 40) : null });
        if (isDemo) logins["Pharmacist — Zamalek (certificate due for renewal)"] = ph.email;
        people.push({ id: ph.id, branch, skill: skill * (0.9 + rand() * 0.2), drive: isDemo ? 1 : Math.max(0, Math.min(1, drive + (rand() - 0.5) * 0.5)), key: isDemo ? "DEMO_PHARMACIST" : "PHARMACIST" });
      }
    }
  }
  const depts = [["Retail Operations", `dept.manager@${DOMAIN}`], ["Quality & Compliance", undefined], ["Training & Development", undefined], ["Category Management", undefined]] as const;
  for (const [department, email] of depts) {
    const dm = await mk({ email, audience: "DEPARTMENT_MANAGER", department, createdDaysAgo: 700, lastLoginDaysAgo: between(0, 5) });
    if (email) logins["Department manager — Retail Operations (all branches)"] = dm.email;
    people.push({ id: dm.id, branch: null, skill: 1.05, drive: 0.75, key: "DEPARTMENT_MANAGER" });
  }

  // ---------- training history ----------
  const mandatory: Record<string, [string, number][]> = {
    PHARMACIST: [["EG-RET-01", 30], ["EG-MED-02", 45]], DEMO_PHARMACIST: [["EG-RET-01", 30], ["EG-MED-02", 45]],
    BRANCH_MANAGER: [["EG-RET-03", 30], ["EG-RET-02", 30]], AREA_MANAGER: [["EG-RET-02", 30]], DEPARTMENT_MANAGER: [["EG-COM-01", 45]],
  };
  for (const p of people) {
    for (const [code, dueDays] of mandatory[p.key]) {
      const c = courses[code]; if (!c) continue;
      const enrolled = ago(between(12, 75));
      await enrol(p.id, c, enrolled, dueDays);
      const r = rand();
      const targetShare = r < p.drive ? 1 : r < p.drive + 0.25 ? 0.3 + rand() * 0.5 : 0;
      if (targetShare > 0) await study(p.id, c, { skill: p.skill, target: targetShare, start: new Date(enrolled.getTime() + DAY), end: ago(between(1, Math.max(2, Math.floor((now.getTime() - enrolled.getTime()) / DAY) - 2))) });
    }
    // optional self-enrolments
    if (p.key === "PHARMACIST" && rand() < p.drive * 0.7) {
      const c = courses[pickOne(["EG-COM-01", "EG-DRM-01", "EG-MED-04"].filter((x) => courses[x]))];
      const enrolled = ago(between(10, 50));
      await enrol(p.id, c, enrolled, null, "self");
      await study(p.id, c, { skill: p.skill, target: rand() < 0.5 ? 1 : 0.5, start: enrolled, end: ago(between(1, 8)) });
    }
  }

  // ---------- showcase cases ----------
  const demoPh = people.find((p) => p.key === "DEMO_PHARMACIST")!;
  // 1. Certificate of antimicrobial stewardship issued ~11.5 months ago → falls due for renewal (validity 12 months)
  const cert = await db.certificate.findUnique({ where: { userId_courseId: { userId: demoPh.id, courseId: med02.id } } });
  if (cert) {
    const issued = ago(350);
    await db.certificate.update({ where: { id: cert.id }, data: { issuedAt: issued, expiresAt: new Date(new Date(issued).setMonth(issued.getMonth() + 12)) } });
    await db.enrollment.update({ where: { userId_courseId: { userId: demoPh.id, courseId: med02.id } }, data: { completedAt: issued, enrolledAt: ago(380), dueAt: ago(335) } });
  }
  // 2. A colleague whose certificate already expired
  const expiredOne = people.find((p) => p.key === "PHARMACIST" && p.branch === "Heliopolis");
  if (expiredOne) {
    const c = await db.certificate.findUnique({ where: { userId_courseId: { userId: expiredOne.id, courseId: med02.id } } });
    if (c) await db.certificate.update({ where: { id: c.id }, data: { issuedAt: ago(400), expiresAt: ago(35) } });
  }
  // 3. Two new hires on the onboarding path (Zamalek and Mansoura)
  for (const [branch, area, email, label] of [["Zamalek", "Cairo West", `new.hire@${DOMAIN}`, "New pharmacist on the onboarding path — Zamalek"], ["Mansoura", "Delta", undefined, null]] as const) {
    const nh = await mk({ email, audience: "PHARMACIST", branch, area, department: "Retail Operations", createdDaysAgo: branch === "Zamalek" ? 12 : 40, lastLoginDaysAgo: branch === "Zamalek" ? 0 : 20 });
    if (label) logins[label] = nh.email;
    const start = ago(branch === "Zamalek" ? 12 : 40);
    await db.pathEnrollment.create({ data: { userId: nh.id, pathId: path.id, startedAt: start, dueAt: new Date(start.getTime() + 30 * DAY) } });
    const seq = ["EG-RET-01", "EG-COM-01", "EG-MED-02"].filter((c) => courses[c]);
    for (const code of seq) await enrol(nh.id, courses[code], start, 30);
    // Zamalek hire: finished course 1, halfway through course 2. Mansoura hire: stuck in course 1 and overdue.
    if (branch === "Zamalek") {
      await study(nh.id, courses[seq[0]], { skill: 1.05, target: 1, start, end: ago(5) });
      await study(nh.id, courses[seq[1]], { skill: 1.05, target: 0.5, start: ago(4), end: ago(1) });
    } else {
      await study(nh.id, courses[seq[0]], { skill: 0.9, target: 0.4, start, end: ago(25) });
    }
    people.push({ id: nh.id, branch, skill: 1, drive: 0.6, key: "PHARMACIST" });
  }

  // ---------- question of the day history (last 21 days) ----------
  const daily: Prisma.DailyAnswerCreateManyInput[] = [];
  const doneLessons = await db.lessonProgress.findMany({ where: { userId: { in: people.map((p) => p.id) }, completedAt: { not: null } }, select: { userId: true, lessonId: true } });
  const byUser = new Map<string, string[]>();
  for (const d of doneLessons) byUser.set(d.userId, [...(byUser.get(d.userId) ?? []), d.lessonId]);
  const qByLesson = new Map<string, Q[]>();
  for (const c of Object.values(courses)) for (const l of c.lessons) if (l.quiz) qByLesson.set(l.id, l.quiz.questions);
  for (const p of people) {
    const lessons = byUser.get(p.id) ?? [];
    if (!lessons.length) continue;
    const streakDays = p.key === "DEMO_PHARMACIST" ? 9 : rand() < p.drive ? between(0, 14) : 0;
    for (let d = 1; d <= 21; d++) {
      const answered = d <= streakDays || rand() < p.drive * 0.35;
      if (!answered) continue;
      const q = pickOne(qByLesson.get(pickOne(lessons)) ?? []);
      if (!q) continue;
      const ok = rand() < pCorrect(q.id, p.skill);
      const opt = ok ? q.options.find((o) => o.isCorrect)! : wrongOption(q);
      const when = ago(d);
      daily.push({ userId: p.id, day: new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(when), questionId: q.id, optionId: opt.id, correct: opt.isCorrect, answeredAt: when, createdAt: when });
    }
  }

  for (let i = 0; i < attemptRows.length; i += 2000) await db.quizAttempt.createMany({ data: attemptRows.slice(i, i + 2000) });
  for (let i = 0; i < answerRows.length; i += 5000) await db.quizAnswer.createMany({ data: answerRows.slice(i, i + 5000), skipDuplicates: true });
  await db.dailyAnswer.createMany({ data: daily, skipDuplicates: true });

  // Open renewals and queue reminders now (the same job the server runs every hour).
  const { runReminders } = await import("../src/lib/reminders");
  const r = await runReminders();
  console.log(`Reminders: ${r.dueSoon} due soon, ${r.overdue} overdue, ${r.renewals} renewals opened, ${r.digests} manager digests.`);

  // ---------- summary ----------
  const total = await db.user.count({ where: { email: { endsWith: `@${DOMAIN}` } } });
  console.log(`\nDemo ready: ${total} staff in ${Object.values(AREAS).flat().length} branches / ${Object.keys(AREAS).length} areas, ${attemptRows.length} quiz attempts, ${answerRows.length} answers, ${daily.length} daily answers.`);
  console.log(`Password for every demo account: ${PASSWORD}\n`);
  for (const [label, email] of Object.entries(logins)) console.log(`  ${label.padEnd(58)} ${email}`);
  console.log(`\nRemove everything afterwards with: npm run seed:demo -- --remove`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
