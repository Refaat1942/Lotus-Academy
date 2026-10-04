import { Prisma } from "@prisma/client";
import { db } from "./db";
import { log } from "./log";

export async function audit(actorId: string | null, action: string, entity?: string, entityId?: string, metadata?: Prisma.InputJsonValue) {
  log("info", "audit", { actorId, action, entity, entityId });
  await db.auditLog.create({ data: { actorId, action, entity, entityId, metadata } });
}
