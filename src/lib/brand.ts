import { cache } from "react";
import { db } from "./db";

export const MAX_BRAND_BYTES = 2 * 1024 * 1024;
export const BRAND_SLOTS = ["logo", "favicon"] as const;
export type BrandSlot = (typeof BRAND_SLOTS)[number];

const startsWith = (b: Buffer, sig: number[], off = 0) => sig.every((v, i) => b[off + i] === v);

/** Detects the real image type from magic bytes (never trusts the file name or browser-supplied MIME). */
export function detectImageType(b: Buffer): string | null {
  if (b.length < 12) return null;
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(b, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(b, [0x47, 0x49, 0x46, 0x38])) return "image/gif";
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (b.toString("ascii", 4, 8) === "ftyp" && /avif|avis/.test(b.toString("ascii", 8, 16))) return "image/avif";
  if (startsWith(b, [0x00, 0x00, 0x01, 0x00])) return "image/x-icon";
  if (startsWith(b, [0x42, 0x4d])) return "image/bmp";
  const head = b.toString("utf8", 0, Math.min(b.length, 2048)).trimStart().toLowerCase();
  if ((head.startsWith("<svg") || head.startsWith("<?xml") || head.startsWith("<!doctype svg")) && head.includes("<svg")) return "image/svg+xml";
  return null;
}

/** SVG can carry active content; reject anything that could execute if opened directly. */
export function svgIsSafe(svg: string): boolean {
  return !/<script|<foreignobject|<iframe|<embed|<object|\son[a-z]+\s*=|javascript:|data:text\/html|<!entity/i.test(svg);
}

export function validateBrandUpload(b: Buffer): { ok: true; mime: string } | { ok: false; error: string } {
  if (b.length === 0) return { ok: false, error: "The file is empty." };
  if (b.length > MAX_BRAND_BYTES) return { ok: false, error: "File is larger than 2 MB." };
  const mime = detectImageType(b);
  if (!mime) return { ok: false, error: "Unsupported file. Use PNG, JPG, WebP, GIF, AVIF, SVG, ICO or BMP." };
  if (mime === "image/svg+xml" && !svgIsSafe(b.toString("utf8"))) return { ok: false, error: "This SVG contains scripts or active content and was rejected." };
  return { ok: true, mime };
}

/** Which brand assets exist (and their version for cache-busting). Cached per request. */
export const getBrand = cache(async () => {
  const rows = await db.brandAsset.findMany({ select: { key: true, updatedAt: true } });
  const v = (k: string) => {
    const r = rows.find((x) => x.key === k);
    return r ? r.updatedAt.getTime() : null;
  };
  return { logo: v("logo"), favicon: v("favicon") };
});
