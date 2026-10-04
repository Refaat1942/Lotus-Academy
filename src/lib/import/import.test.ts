import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import AdmZip from "adm-zip";
import { detectDuplicates, readArchive } from "./run";
import { isUsableQuestion, parseLesson, parseOverview, parseQuiz } from "./parse";

const SRC = path.resolve(__dirname, "../../../content/sources");
const archives = fs.readdirSync(SRC).filter((f) => f.endsWith(".zip")).sort().map((f) => readArchive(path.join(SRC, f)));

describe("importer: source archives", () => {
  it("reads all 7 distinct course archives", () => {
    expect(archives.map((a) => a.courseCode)).toEqual(["EG-MED-01", "EG-MED-02", "EG-MED-03", "EG-MED-04", "EG-MED-05", "EG-MED-07", "EG-MED-08"]);
  });
  it("finds 47 lessons in total and each overview index matches its files", () => {
    let lessons = 0;
    for (const a of archives) {
      const ov = parseOverview(a.files.get(`courses/${a.folder}/course-overview.md`)!.toString());
      const files = [...a.files.keys()].filter((n) => n.includes("/lessons/"));
      expect(ov.lessonFiles.length).toBe(files.length);
      lessons += files.length;
    }
    expect(lessons).toBe(47);
  });
  it("every lesson has an ID, duration and objectives", () => {
    for (const a of archives) for (const [n, d] of a.files) {
      if (!n.includes("/lessons/")) continue;
      const l = parseLesson(d.toString());
      expect(l.code, n).toMatch(/^EG-MED-\d\d-L\d\d$/);
      expect(l.durationMinutes, n).toBeGreaterThan(0);
      expect(l.objectives.length, n).toBeGreaterThan(0);
      expect(l.bodyMd, n).not.toMatch(/Lesson Quiz/);
    }
  });
});

describe("importer: duplicate detection", () => {
  it("flags a byte-identical copy and a repackaged identical course", () => {
    const base = archives[5]; // pediatrics
    const copy = { ...base, fileName: "Course-07-pediatrics (1).zip" };
    const list = [{ ...base }, copy, { ...archives[0] }];
    detectDuplicates(list);
    expect(list.map((a) => a.isDuplicate)).toEqual([false, true, false]);
    expect(list[1].duplicateOf).toBe(base.fileName);
  });
  it("detects identical content even when the ZIP bytes differ", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "imp-"));
    const src = new AdmZip(path.join(SRC, "Course-08-womens-health.zip"));
    const re = new AdmZip();
    for (const e of src.getEntries().reverse()) if (!e.isDirectory) re.addFile(e.entryName, e.getData());
    fs.writeFileSync(path.join(tmp, "repack.zip"), re.toBuffer());
    const a = readArchive(path.join(SRC, "Course-08-womens-health.zip"));
    const b = readArchive(path.join(tmp, "repack.zip"));
    expect(a.sha256).not.toBe(b.sha256);
    expect(a.contentHash).toBe(b.contentHash);
  });
});

describe("importer: safety", () => {
  it("rejects path-traversal entries", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "imp-"));
    // adm-zip sanitises names on write, so craft the hostile archive with Python's zipfile.
    execFileSync("python3", ["-c", "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1],'w'); z.writestr('courses/x/course-overview.md','# x'); z.writestr('../../evil.md','x'); z.close()", path.join(tmp, "evil.zip")]);
    expect(() => readArchive(path.join(tmp, "evil.zip"))).toThrow(/unsafe entry/);
  });
  it("ignores non-markdown payloads", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "imp-"));
    const z = new AdmZip();
    z.addFile("courses/x/course-overview.md", Buffer.from("# x"));
    z.addFile("courses/x/run.sh", Buffer.from("rm -rf /"));
    fs.writeFileSync(path.join(tmp, "a.zip"), z.toBuffer());
    expect([...readArchive(path.join(tmp, "a.zip")).files.keys()]).toEqual(["courses/x/course-overview.md"]);
  });
});

describe("quiz parsing", () => {
  it("parses options and correct marks, and flags correct-only questions as unusable", () => {
    const qs = parseQuiz("**Q1.** A?\n- a) x\n- b) y ✓\n\n**Q2.** B?\n- a) only ✓\n");
    expect(qs[0].options.map((o) => o.isCorrect)).toEqual([false, true]);
    expect(isUsableQuestion(qs[0])).toBe(true);
    expect(isUsableQuestion(qs[1])).toBe(false);
  });
});
