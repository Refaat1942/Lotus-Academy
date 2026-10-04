// Usage: ADMIN_EMAIL=you@x.com ADMIN_PASSWORD='...' npm run create:admin [-- --role ADMIN]
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedRolesAndSettings } from "../src/lib/seed-core";
import { passwordProblem } from "../src/lib/password";

async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const roleKey = process.argv.includes("--role") ? process.argv[process.argv.indexOf("--role") + 1] : "SUPER_ADMIN";
  if (!email || !password) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD environment variables.");
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);
  const db = new PrismaClient();
  try {
    await seedRolesAndSettings(db);
    const role = await db.role.findUniqueOrThrow({ where: { key: roleKey } });
    const user = await db.user.upsert({
      where: { email },
      update: { passwordHash: await bcrypt.hash(password, 12), status: "ACTIVE", emailVerifiedAt: new Date() },
      create: { email, firstName: process.env.ADMIN_FIRST_NAME ?? "Admin", lastName: process.env.ADMIN_LAST_NAME ?? "User", passwordHash: await bcrypt.hash(password, 12), status: "ACTIVE", emailVerifiedAt: new Date() },
    });
    await db.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: role.id } }, update: {}, create: { userId: user.id, roleId: role.id } });
    console.log(`${roleKey} ready: ${email}`);
  } finally {
    await db.$disconnect();
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
