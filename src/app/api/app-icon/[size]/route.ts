import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const SIZES: Record<string, { px: number; pad: number; file: string }> = {
  "192": { px: 192, pad: 0.12, file: "icon-192.png" },
  "512": { px: 512, pad: 0.12, file: "icon-512.png" },
  maskable: { px: 512, pad: 0.24, file: "maskable-512.png" },
  apple: { px: 180, pad: 0.1, file: "apple-touch-icon.png" },
};

/**
 * App (PWA) icon built from the logo uploaded in Admin → Branding: the logo is centred on a white square.
 * Falls back to the default Lotus mark when no logo has been uploaded.
 */
export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const s = SIZES[size];
  if (!s) return new Response("Not found", { status: 404 });
  const asset = (await db.brandAsset.findUnique({ where: { key: "favicon" } })) ?? (await db.brandAsset.findUnique({ where: { key: "logo" } }));
  let png: Buffer | null = null;
  if (asset) {
    try {
      const inner = Math.round(s.px * (1 - 2 * s.pad));
      const logo = await sharp(Buffer.from(asset.data), { density: 300 }).resize(inner, inner, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer();
      png = await sharp({ create: { width: s.px, height: s.px, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
        .composite([{ input: logo, gravity: "centre" }]).png().toBuffer();
    } catch { png = null; } // unreadable upload (e.g. ICO) → default icon
  }
  png ??= await fs.readFile(path.join(process.cwd(), "public", "icons", s.file));
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" } });
}
