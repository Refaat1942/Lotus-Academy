import { db } from "@/lib/db";
import { BRAND_SLOTS } from "@/lib/brand";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ slot: string }> }) {
  const { slot } = await params;
  if (!(BRAND_SLOTS as readonly string[]).includes(slot) && !/^course-[a-z0-9]{10,40}$/.test(slot)) return new Response("Not found", { status: 404 });
  const a = await db.brandAsset.findUnique({ where: { key: slot } });
  if (!a) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(a.data), {
    headers: {
      "Content-Type": a.mime,
      "Cache-Control": "public, max-age=86400", // URLs are versioned with ?v=<updatedAt>
      "X-Content-Type-Options": "nosniff",
      // If an SVG is ever opened directly, nothing in it may run.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
