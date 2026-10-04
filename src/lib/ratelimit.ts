import { db } from "./db";

/** Fixed-window limiter backed by PostgreSQL (shared across instances). Returns true if allowed. */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSec * 1000);
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt") VALUES (${key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."resetAt" < ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" < ${now} THEN ${resetAt} ELSE "RateLimit"."resetAt" END
    RETURNING "count"`;
  return rows[0].count <= limit;
}
