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

// ---------- Randomised attempts ----------
/** Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Picks `count` distinct ids at random (all of them, shuffled, when count is 0 or exceeds the bank). */
export function drawQuestions(ids: string[], count: number, rand: () => number = Math.random): string[] {
  const s = shuffle(ids, rand);
  return count > 0 && count < s.length ? s.slice(0, count) : s;
}

/** A lesson is unlocked when it is the first one or the previous lesson is completed. */
export function isLessonUnlocked(lessons: { id: string }[], completed: Set<string>, index: number): boolean {
  return index <= 0 || completed.has(lessons[index - 1].id);
}
