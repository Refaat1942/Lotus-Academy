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
  // Default job roles / learning tracks (admins can rename them or add more).
  const audiences = [
    { key: "PHARMACIST", nameEn: "Pharmacists", nameAr: "الصيادلة", sortOrder: 1 },
    { key: "BRANCH_MANAGER", nameEn: "Branch managers", nameAr: "مديرو الفروع", sortOrder: 2 },
    { key: "AREA_MANAGER", nameEn: "Area managers", nameAr: "مديرو المناطق", sortOrder: 3 },
    { key: "DEPARTMENT_MANAGER", nameEn: "Department managers", nameAr: "مديرو الإدارات", sortOrder: 4 },
  ];
  for (const a of audiences) await db.audience.upsert({ where: { key: a.key }, update: {}, create: a });

  const defaults: Record<string, unknown> = {
    "brand.name": { en: "LOTUS ACADEMY", ar: "أكاديمية لوتس" },
    "brand.subtitle": { en: "Pharmacy Education & Professional Development", ar: "للتعليم والتطوير المهني للصيادلة" },
    "contact.email": "academy@example.com",
    "certificate.issuer": { en: "Lotus Academy", ar: "أكاديمية لوتس" },
    // "approval": new sign-ups wait for an admin; "email": verify by email (needs SMTP); "closed": admins create accounts.
    "registration.mode": process.env.SMTP_HOST ? "email" : "approval",
  };
  for (const [key, value] of Object.entries(defaults)) {
    await db.systemSetting.upsert({ where: { key }, update: {}, create: { key, value: value as never } });
  }
}
