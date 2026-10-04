import path from "path";
import { PrismaClient } from "@prisma/client";
import { importArchives } from "../src/lib/import/run";

async function main() {
  const dir = path.resolve(process.argv[2] ?? "content/sources");
  const db = new PrismaClient();
  try {
    const report = await importArchives(db, dir);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await db.$disconnect();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
