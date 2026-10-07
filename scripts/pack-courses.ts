// Packs authored course folders (content/courses-src/NN-slug) into importable ZIPs (content/sources/Course-NN-slug.zip).
// Usage: npm run pack:courses [-- 09-selling-skills ...]   (no args = all numbered folders)
import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";

const SRC = path.resolve("content/courses-src");
const OUT = path.resolve("content/sources");
const only = process.argv.slice(2);
const folders = fs.readdirSync(SRC).filter((f) => /^\d\d-/.test(f) && fs.statSync(path.join(SRC, f)).isDirectory() && (!only.length || only.includes(f))).sort();
fs.mkdirSync(OUT, { recursive: true });

for (const f of folders) {
  const zip = new AdmZip();
  const files = fs.readdirSync(path.join(SRC, f)).filter((n) => n.endsWith(".md") && !/^(AUTHOR_NOTES|README)/i.test(n)).sort();
  for (const n of files) {
    zip.addFile(`courses/${f}/${n}`, fs.readFileSync(path.join(SRC, f, n)));
  }
  for (const e of zip.getEntries()) e.header.time = new Date(2026, 0, 1); // reproducible archives
  const out = path.join(OUT, `Course-${f}.zip`);
  zip.writeZip(out);
  console.log(`packed ${f}: ${files.length} files -> ${path.relative(process.cwd(), out)}`);
}
