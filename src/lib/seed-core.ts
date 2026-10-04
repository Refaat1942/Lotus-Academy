import { PrismaClient } from "@prisma/client";
import { PERMISSIONS, ROLES } from "./permissions";

export async function seedRolesAndSettings(db: PrismaClient) {
  for (const key of PERMISSIONS) {
    await db.permission.upsert({ where: { key }, update: {}, create: { key } });
  }
  const perms = await db.permission.findMany();
  for (const [key, def] of Object.entries(ROLES)) {
    const role = await db.role.upsert({ where: { key }, update: { name: def.name }, create: { key, name: def.name } });
    const wanted = def.permissions === "*" ? perms : perms.filter((p) => (def.permissions as readonly string[]).includes(p.key));
    await db.rolePermission.deleteMany({ where: { roleId: role.id } });
    await db.rolePermission.createMany({ data: wanted.map((p) => ({ roleId: role.id, permissionId: p.id })) });
  }
  const defaults: Record<string, unknown> = {
    "brand.name": { en: "LOTUS ACADEMY", ar: "أكاديمية لوتس" },
    "brand.subtitle": { en: "Pharmacy Education & Professional Development", ar: "للتعليم والتطوير المهني للصيادلة" },
    "contact.email": "academy@example.com",
    "certificate.issuer": { en: "Lotus Academy", ar: "أكاديمية لوتس" },
  };
  for (const [key, value] of Object.entries(defaults)) {
    await db.systemSetting.upsert({ where: { key }, update: {}, create: { key, value: value as never } });
  }
}
