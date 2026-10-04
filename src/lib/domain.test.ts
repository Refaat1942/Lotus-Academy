import { describe, expect, it } from "vitest";
import { attemptsRemaining, computeCompletion, gradeQuiz, resumeLesson } from "./domain";
import { newCertificateId } from "./tokens";

const q = (id: string, correct: string[], all = ["a", "b", "c"]) => ({ id, points: 1, options: all.map((o) => ({ id: `${id}${o}`, isCorrect: correct.includes(o) ? true : false })) });

describe("quiz grading", () => {
  const qs = [q("1", ["b"]), q("2", ["a", "c"]), q("3", ["c"])];
  it("scores correct answers and applies pass mark", () => {
    const r = gradeQuiz(qs, { "1": ["1b"], "2": ["2a", "2c"], "3": ["3a"] }, 60);
    expect(r.scorePct).toBe(67);
    expect(r.passed).toBe(true);
  });
  it("requires exact set for multiple-correct questions", () => {
    expect(gradeQuiz(qs, { "2": ["2a"] }, 50).results[1].isCorrect).toBe(false);
  });
  it("ignores forged option ids and unanswered questions", () => {
    const r = gradeQuiz(qs, { "1": ["1b", "evil"], "2": ["9z"] }, 70);
    expect(r.results[0].optionIds).toEqual(["1b"]); // forged id dropped, never stored
    expect(r.results[1].isCorrect).toBe(false);
    expect(r.scorePct).toBe(33);
    expect(r.passed).toBe(false);
  });
  it("never passes an empty quiz", () => expect(gradeQuiz([], {}, 0).passed).toBe(false));
});

describe("course completion", () => {
  it("needs all lessons and required quizzes", () => {
    const base = { publishedLessonIds: ["l1", "l2"], completedLessonIds: new Set(["l1", "l2"]) };
    expect(computeCompletion({ ...base, requiredQuizzes: [{ id: "q", passed: false }] }).complete).toBe(false);
    expect(computeCompletion({ ...base, requiredQuizzes: [{ id: "q", passed: true }] }).complete).toBe(true);
    expect(computeCompletion({ ...base, completedLessonIds: new Set(["l1"]), requiredQuizzes: [] })).toMatchObject({ percent: 50, complete: false });
  });
  it("is not complete with zero lessons", () => {
    expect(computeCompletion({ publishedLessonIds: [], completedLessonIds: new Set(), requiredQuizzes: [] }).complete).toBe(false);
  });
});

describe("attempts and resume", () => {
  it("handles unlimited and limited attempts", () => {
    expect(attemptsRemaining(0, 9)).toBeNull();
    expect(attemptsRemaining(3, 2)).toBe(1);
    expect(attemptsRemaining(3, 5)).toBe(0);
  });
  it("resumes the last viewed incomplete lesson, else first incomplete", () => {
    const ls = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(resumeLesson(ls, new Set(["a"]), "c")).toBe("c");
    expect(resumeLesson(ls, new Set(["a", "c"]), "c")).toBe("b");
    expect(resumeLesson(ls, new Set(["a", "b", "c"]), null)).toBe("a");
  });
});

describe("certificate ids", () => {
  it("are unique, well-formed and non-sequential", () => {
    const ids = new Set(Array.from({ length: 2000 }, newCertificateId));
    expect(ids.size).toBe(2000);
    expect([...ids][0]).toMatch(/^LA-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });
});

import { buildCheckpointPool, drawCheckpoint, isLessonUnlocked } from "./domain";

describe("checkpoint", () => {
  const full = { id: "q1", promptEn: "Real?", options: [{ id: "a", textEn: "x", isCorrect: false }, { id: "b", textEn: "y", isCorrect: true }] };
  const bare = (n: number) => ({ id: `b${n}`, promptEn: `Bare ${n}?`, options: [{ id: `o${n}`, textEn: `answer ${n}`, isCorrect: true }] });
  it("keeps real questions and derives distractors for correct-only ones, deterministically", () => {
    const qs = [full, bare(1), bare(2), bare(3), bare(4)];
    const a = buildCheckpointPool(qs), b = buildCheckpointPool(qs);
    expect(a).toEqual(b);
    const derived = a.find((q) => q.id === "b1")!;
    expect(derived.options).toHaveLength(4);
    expect(derived.options.filter((o) => o.isCorrect).map((o) => o.text)).toEqual(["answer 1"]);
    expect(new Set(derived.options.map((o) => o.text)).size).toBe(4);
    expect(a.find((q) => q.id === "q1")!.options).toHaveLength(2);
  });
  it("skips questions without a correct answer or enough distractors", () => {
    expect(buildCheckpointPool([bare(1)])).toEqual([]);
    expect(buildCheckpointPool([{ id: "z", promptEn: "?", options: [{ id: "o", textEn: "t", isCorrect: false }] }])).toEqual([]);
  });
  it("draws distinct ids and locks lessons sequentially", () => {
    const pool = buildCheckpointPool([full, bare(1), bare(2), bare(3)]);
    const ids = drawCheckpoint(pool, 2);
    expect(new Set(ids).size).toBe(2);
    const ls = [{ id: "l1" }, { id: "l2" }, { id: "l3" }];
    expect(isLessonUnlocked(ls, new Set(), 0)).toBe(true);
    expect(isLessonUnlocked(ls, new Set(), 1)).toBe(false);
    expect(isLessonUnlocked(ls, new Set(["l1"]), 1)).toBe(true);
    expect(isLessonUnlocked(ls, new Set(["l1"]), 2)).toBe(false);
  });
});
