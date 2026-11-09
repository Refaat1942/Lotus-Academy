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

import { drawQuestions, isLessonUnlocked, shuffle } from "./domain";

describe("randomised attempts", () => {
  it("draws the requested number of distinct questions, or all of them", () => {
    const ids = Array.from({ length: 10 }, (_, i) => `q${i}`);
    const five = drawQuestions(ids, 5);
    expect(five).toHaveLength(5);
    expect(new Set(five).size).toBe(5);
    expect(five.every((x) => ids.includes(x))).toBe(true);
    expect(drawQuestions(ids, 0).sort()).toEqual([...ids].sort());
    expect(drawQuestions(ids, 50)).toHaveLength(10);
  });
  it("produces different draws across attempts and keeps every element when shuffling", () => {
    const ids = Array.from({ length: 10 }, (_, i) => `q${i}`);
    const draws = new Set(Array.from({ length: 20 }, () => drawQuestions(ids, 5).join(",")));
    expect(draws.size).toBeGreaterThan(1);
    expect(shuffle([1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]);
  });
  it("locks lessons sequentially", () => {
    const ls = [{ id: "l1" }, { id: "l2" }, { id: "l3" }];
    expect(isLessonUnlocked(ls, new Set(), 0)).toBe(true);
    expect(isLessonUnlocked(ls, new Set(), 1)).toBe(false);
    expect(isLessonUnlocked(ls, new Set(["l1"]), 1)).toBe(true);
  });
});

import { isoWeek } from "./reminders";
import { cairoDay } from "./engagement";
import { stepsFor } from "./paths";
import { certState, expiryFrom } from "./learning";

describe("engagement helpers", () => {
  it("labels ISO weeks", () => {
    expect(isoWeek(new Date(2026, 0, 1))).toBe("2026-W01");
    expect(isoWeek(new Date(2026, 10, 9))).toBe("2026-W46");
    expect(isoWeek(new Date(2027, 0, 1))).toBe("2026-W53");
  });
  it("uses the Egyptian calendar day", () => {
    expect(cairoDay(new Date("2026-11-09T22:30:00Z"))).toBe("2026-11-10");
    expect(cairoDay(new Date("2026-11-09T10:00:00Z"))).toBe("2026-11-09");
  });
  it("computes certificate expiry and state", () => {
    const from = new Date(2026, 0, 15);
    expect(expiryFrom(12, from)!.getFullYear()).toBe(2027);
    expect(expiryFrom(null, from)).toBeNull();
    const now = new Date(2026, 5, 1);
    expect(certState({ revokedAt: null, expiresAt: null }, now)).toBe("valid");
    expect(certState({ revokedAt: null, expiresAt: new Date(2026, 5, 20) }, now)).toBe("expiring");
    expect(certState({ revokedAt: null, expiresAt: new Date(2026, 4, 20) }, now)).toBe("expired");
    expect(certState({ revokedAt: now, expiresAt: null }, now)).toBe("revoked");
  });
  it("orders path steps: done, then the current course, then locked", () => {
    const c = (id: string) => ({ courseId: id, course: { slug: id, titleEn: id, titleAr: null, durationMinutes: 60, category: null } });
    const s = stepsFor([c("a"), c("b"), c("c")], new Set(["a"]), new Map([["b", 40]]));
    expect(s.map((x) => [x.done, x.current, x.locked, x.percent])).toEqual([[true, false, false, 100], [false, true, false, 40], [false, false, true, 0]]);
  });
});
