// Usage: npx tsx scripts/validate-course.ts content/courses-src/09-selling-skills [...more folders]
import fs from "fs";
import path from "path";
import { validateCourseDir } from "../src/lib/import/validate";

let failed = 0;
for (const arg of process.argv.slice(2)) {
  const dir = path.resolve(arg);
  if (!fs.existsSync(dir)) { console.error(`✗ ${arg}: not found`); failed++; continue; }
  const r = validateCourseDir(dir);
  console.log(`${r.errors.length ? "✗" : "✓"} ${arg}: ${r.stats.lessons} lessons, ${r.stats.questions} questions, ${r.stats.words} words, ${r.errors.length} errors, ${r.warnings.length} warnings`);
  r.errors.slice(0, 60).forEach((e) => console.log("  ERROR  " + e));
  r.warnings.slice(0, 20).forEach((w) => console.log("  warn   " + w));
  if (r.errors.length > 60) console.log(`  … ${r.errors.length - 60} more errors`);
  if (r.errors.length) failed++;
}
process.exit(failed ? 1 : 0);
