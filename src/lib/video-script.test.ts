import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { parseScenes, sentences } from "./video-script";
import { parseVideoScript } from "./import/parse";

describe("video script → narrated scenes", () => {
  it("parses scenes, on-screen text and narration in English and Arabic", () => {
    const md = fs.readFileSync("content/courses-src/09-selling-skills/lesson-01-selling-mindset-and-ethics.video.md", "utf8");
    const { en, ar } = parseVideoScript(md);
    const s = parseScenes(en);
    expect(s.length).toBe(6);
    expect(s[2].onScreen).toBe("Patient first");
    expect(s[0].lines[0]).toMatch(/^In a pharmacy/);
    const a = parseScenes(ar);
    expect(a.length).toBe(6);
    expect(a[2].onScreen).toBe("المريض أولًا");
    expect(a[0].lines.join(" ")).not.toMatch(/المعلّق/);
  });
  it("parses every authored video script into at least 3 narrated scenes", () => {
    const dir = "content/courses-src";
    for (const c of fs.readdirSync(dir).filter((d) => /^\d\d-/.test(d))) {
      for (const f of fs.readdirSync(`${dir}/${c}`).filter((n) => n.endsWith(".video.md"))) {
        const { en, ar } = parseVideoScript(fs.readFileSync(`${dir}/${c}/${f}`, "utf8"));
        expect(parseScenes(en).filter((x) => x.lines.length).length, `${c}/${f} en`).toBeGreaterThanOrEqual(3);
        expect(parseScenes(ar).filter((x) => x.lines.length).length, `${c}/${f} ar`).toBeGreaterThanOrEqual(3);
      }
    }
  });
  it("splits sentences on Latin and Arabic punctuation", () => {
    expect(sentences("One. Two? ثلاثة؟ أربعة.")).toEqual(["One.", "Two?", "ثلاثة؟", "أربعة."]);
  });
});
