import { db } from "@/lib/db";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", database: "up" });
  } catch (e) {
    log("error", "health.db_failed", { error: e instanceof Error ? e.message : String(e) });
    return Response.json({ status: "error", database: "down" }, { status: 503 });
  }
}
