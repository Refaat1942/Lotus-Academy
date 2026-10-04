import { PrismaClient } from "@prisma/client";
import { seedRolesAndSettings } from "../src/lib/seed-core";

const db = new PrismaClient();
seedRolesAndSettings(db)
  .then(() => console.log("Roles, permissions and settings seeded."))
  .finally(() => db.$disconnect());
