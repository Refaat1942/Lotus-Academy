// Pure domain rules (no I/O) so they can be unit tested.

export function computeCompletion(input: {
  publishedLessonIds: string[];
  completedLessonIds: Set<string>;
  requiredQuizzes: { id: string; passed: boolean }[];
}) {
  const total = input.publishedLessonIds.length;
  const done = input.publishedLessonIds.filter((id) => input.completedLessonIds.has(id)).length;
  const quizzesOk = input.requiredQuizzes.every((q) => q.passed);
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { total, done, percent, quizzesOk, complete: total > 0 && done === total && quizzesOk };
}

export interface GradeQuestion {
  id: string;
  points: number;
  options: { id: string; isCorrect: boolean }[];
}

/** Grades a submission. A question is correct only if the selected set equals the correct set exactly. */
export function gradeQuiz(questions: GradeQuestion[], submitted: Record<string, string[]>, passMark: number) {
  let earned = 0;
  let possible = 0;
  const results = questions.map((q) => {
    possible += q.points;
    const valid = new Set(q.options.map((o) => o.id));
    const picked = new Set((submitted[q.id] ?? []).filter((id) => valid.has(id))); // ignore forged option ids
    const correct = new Set(q.options.filter((o) => o.isCorrect).map((o) => o.id));
    const isCorrect = picked.size === correct.size && [...picked].every((id) => correct.has(id));
    if (isCorrect) earned += q.points;
    return { questionId: q.id, optionIds: [...picked], isCorrect };
  });
  const scorePct = possible === 0 ? 0 : Math.round((earned / possible) * 100);
  return { scorePct, passed: possible > 0 && scorePct >= passMark, results };
}

export function attemptsRemaining(maxAttempts: number, used: number): number | null {
  return maxAttempts === 0 ? null : Math.max(0, maxAttempts - used);
}

/** Picks the lesson to resume: last viewed incomplete lesson, else first incomplete, else first. */
export function resumeLesson(
  lessons: { id: string }[],
  completed: Set<string>,
  lastLessonId: string | null,
): string | null {
  if (!lessons.length) return null;
  if (lastLessonId && lessons.some((l) => l.id === lastLessonId) && !completed.has(lastLessonId)) return lastLessonId;
  return (lessons.find((l) => !completed.has(l.id)) ?? lessons[0]).id;
}

// ---------- Checkpoint ("check your understanding") ----------
export interface SourceQuestion {
  id: string;
  promptEn: string;
  promptAr?: string | null;
  options: { id: string; textEn: string; textAr?: string | null; isCorrect: boolean }[];
}
export interface PoolQuestion {
  id: string;
  prompt: string;
  promptAr?: string | null;
  options: { id: string; text: string; textAr?: string | null; isCorrect: boolean }[];
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function seededShuffle<T>(arr: T[], seed: string): T[] {
  const a = [...arr];
  let s = hash(seed) || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Builds the checkpoint question bank from a lesson's quiz questions. Questions with real distractors are used as-is.
 * Questions that only carry their correct answer get deterministic distractors borrowed from the other questions'
 * correct answers in the same lesson, so the server can always recompute the identical options.
 */
export function buildCheckpointPool(questions: SourceQuestion[]): PoolQuestion[] {
  const arOf = new Map<string, string | null | undefined>();
  for (const q of questions) for (const o of q.options) if (o.isCorrect) arOf.set(o.textEn, o.textAr);
  const correctTexts = [...arOf.keys()];
  const pool: PoolQuestion[] = [];
  for (const q of questions) {
    const correct = q.options.filter((o) => o.isCorrect);
    if (!correct.length) continue;
    if (q.options.length >= 2) {
      pool.push({ id: q.id, prompt: q.promptEn, promptAr: q.promptAr, options: q.options.map((o) => ({ id: o.id, text: o.textEn, textAr: o.textAr, isCorrect: o.isCorrect })) });
      continue;
    }
    const own = correct[0].textEn;
    const distractors = seededShuffle(correctTexts.filter((t) => t !== own), q.id).slice(0, 3);
    if (distractors.length < 2) continue;
    const opts = [{ id: `${q.id}#c`, text: own, textAr: correct[0].textAr, isCorrect: true }, ...distractors.map((t, i) => ({ id: `${q.id}#d${i}`, text: t, textAr: arOf.get(t), isCorrect: false }))];
    pool.push({ id: q.id, prompt: q.promptEn, promptAr: q.promptAr, options: seededShuffle(opts, q.id + "o") });
  }
  return pool;
}

/** Draws up to n distinct question ids. */
export function drawCheckpoint(pool: PoolQuestion[], n = 2, rand: () => number = Math.random): string[] {
  const ids = pool.map((q) => q.id);
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  return ids.slice(0, Math.min(n, ids.length));
}

/** A lesson is unlocked when it is the first one or the previous lesson is completed. */
export function isLessonUnlocked(lessons: { id: string }[], completed: Set<string>, index: number): boolean {
  return index <= 0 || completed.has(lessons[index - 1].id);
}
