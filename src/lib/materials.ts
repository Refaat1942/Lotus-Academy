import AdmZip from "adm-zip";

export const MAX_MATERIAL_BYTES = 15 * 1024 * 1024;

const OFFICE: Record<string, { dir: string; mime: string }> = {
  docx: { dir: "word/", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  pptx: { dir: "ppt/", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
  xlsx: { dir: "xl/", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
};
const sig = (b: Buffer, s: number[]) => s.every((v, i) => b[i] === v);

/** Validates an uploaded learning material by content (not by name/MIME). Returns the canonical MIME type. */
export function validateMaterial(b: Buffer, fileName: string): { ok: true; mime: string } | { ok: false; error: string } {
  if (!b.length) return { ok: false, error: "The file is empty." };
  if (b.length > MAX_MATERIAL_BYTES) return { ok: false, error: "File is larger than 15 MB." };
  if (b.toString("ascii", 0, 5) === "%PDF-") return { ok: true, mime: "application/pdf" };
  if (sig(b, [0x89, 0x50, 0x4e, 0x47])) return { ok: true, mime: "image/png" };
  if (sig(b, [0xff, 0xd8, 0xff])) return { ok: true, mime: "image/jpeg" };
  if (b.toString("ascii", 0, 4) === "GIF8") return { ok: true, mime: "image/gif" };
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return { ok: true, mime: "image/webp" };
  if (sig(b, [0x50, 0x4b, 0x03, 0x04])) {
    const ext = fileName.toLowerCase().split(".").pop() ?? "";
    const kind = OFFICE[ext];
    if (!kind) return { ok: false, error: "Unsupported file type. Use PDF, DOCX, PPTX, XLSX, PNG, JPG, GIF or WebP." };
    try {
      const names = new AdmZip(b).getEntries().map((e) => e.entryName.toLowerCase());
      if (names.some((n) => n.includes("vbaproject.bin"))) return { ok: false, error: "Files containing macros are not allowed." };
      if (!names.includes("[content_types].xml") || !names.some((n) => n.startsWith(kind.dir))) return { ok: false, error: `This is not a valid .${ext} file.` };
    } catch {
      return { ok: false, error: "This file could not be read." };
    }
    return { ok: true, mime: kind.mime };
  }
  return { ok: false, error: "Unsupported file type. Use PDF, DOCX, PPTX, XLSX, PNG, JPG, GIF or WebP." };
}

export const safeFileName = (n: string) => n.replace(/[^\w.\- ()؀-ۿ]/g, "_").slice(0, 120) || "file";
