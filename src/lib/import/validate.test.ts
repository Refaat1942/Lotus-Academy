import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { validateCourseDir } from "./validate";

const mk = (files: Record<string, string>) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "val-"));
  for (const [n, c] of Object.entries(files)) fs.writeFileSync(path.join(dir, n), c);
  return dir;
};

describe("course validator", () => {
  it("flags missing files and structure problems", () => {
    const r = validateCourseDir(mk({ "course-overview.md": "# Course 1 Overview: X\n# نظرة عامة — س\n\n| Field | Value |\n|---|---|\n| **Course ID** | EG-X-01 |\n" }));
    expect(r.errors.join("\n")).toMatch(/missing course-overview.ar.md/);
    expect(r.errors.join("\n")).toMatch(/final-exam.md missing/);
  });
  it("rejects personal names and active HTML in lessons", () => {
    const lesson = `# Lesson 1.1: T\n# الدرس 1.1: ع\n\n| | |\n|---|---|\n| **Duration** | 60 minutes |\n| **Lesson ID** | EG-X-01-L01 |\n\n## Learning objectives\n\n1. a\n2. b\n3. c\n\n## Body\n\nThe customer Ahmed asked <script>x</script> and Dr. Hassan agreed.\n\n## Key takeaways\n\n- x\n`;
    const dir = mk({
      "course-overview.md": "# Course 1 Overview: X\n# نظرة عامة — س\n\n| Field | Value |\n|---|---|\n| **Course ID** | EG-X-01 |\n| **Duration** | 1 hours |\n\n## Lesson index\n\n| # | File | Topic |\n|---|---|---|\n| 1 | lesson-01-a.md | A |\n",
      "lesson-01-a.md": lesson,
    });
    const msg = validateCourseDir(dir).errors.join("\n");
    expect(msg).toMatch(/personal name "Ahmed"/);
    expect(msg).toMatch(/active HTML/);
    expect(msg).toMatch(/person's name\/title/);
  });
});
