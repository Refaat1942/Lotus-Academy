import AdmZip from "adm-zip";
import { describe, expect, it } from "vitest";
import { validateMaterial } from "./materials";

const office = (dir: string, extra?: string) => { const z = new AdmZip(); z.addFile("[Content_Types].xml", Buffer.from("<x/>")); z.addFile(`${dir}document.xml`, Buffer.from("<x/>")); if (extra) z.addFile(extra, Buffer.from("x")); return z.toBuffer(); };

describe("material validation", () => {
  it("accepts PDF and real Office files", () => {
    expect(validateMaterial(Buffer.from("%PDF-1.7 hello"), "a.pdf")).toEqual({ ok: true, mime: "application/pdf" });
    expect(validateMaterial(office("word/"), "a.docx").ok).toBe(true);
    expect(validateMaterial(office("ppt/"), "a.pptx").ok).toBe(true);
  });
  it("rejects macros, mismatches, executables and oversize", () => {
    expect(validateMaterial(office("word/", "word/vbaProject.bin"), "a.docx").ok).toBe(false);
    expect(validateMaterial(office("word/"), "a.xlsx").ok).toBe(false);
    expect(validateMaterial(office("word/"), "a.zip").ok).toBe(false);
    expect(validateMaterial(Buffer.from("MZ\x90\x00 exe"), "a.pdf").ok).toBe(false);
    expect(validateMaterial(Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(16 * 1024 * 1024)]), "a.pdf").ok).toBe(false);
  });
});
