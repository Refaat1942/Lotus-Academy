import crypto from "crypto";
import { db } from "./db";
import { hashPassword } from "./auth-core";
import { syncAssignments } from "./audience";

/** Minimal RFC-4180 CSV parser (quotes, escaped quotes, commas/newlines inside quotes, BOM). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

/** 12-char temporary password with letters and digits (meets the password policy). */
export function tempPassword(): string {
  const alpha = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ", digits = "23456789";
  const b = crypto.randomBytes(12);
  const chars = Array.from(b, (x, i) => (i % 4 === 3 ? digits[x % digits.length] : alpha[x % alpha.length]));
  return chars.join("");
}

const norm = (h: string) => h.toLowerCase().replace(/[^a-z]/g, "");
const HEADERS: Record<string, string> = { email: "email", firstname: "firstName", first: "firstName", lastname: "lastName", last: "lastName", phone: "phone", mobile: "phone", jobrole: "jobRole", role: "jobRole", audience: "jobRole", track: "jobRole", branch: "branch", area: "area", region: "area", department: "department" };

export interface ImportResult { created: number; updated: number; assigned: number; errors: string[]; credentials: { email: string; password: string }[] }

/**
 * Creates or updates learner accounts from CSV. New accounts are ACTIVE with a temporary password that must be
 * changed at first sign-in. Existing accounts get their profile fields updated (password untouched).
 */
export async function importUsers(csv: string, maxRows = 2000): Promise<ImportResult> {
  const rows = parseCsv(csv);
  const res: ImportResult = { created: 0, updated: 0, assigned: 0, errors: [], credentials: [] };
  if (rows.length < 2) { res.errors.push("The file needs a header row and at least one user."); return res; }
  const cols = rows[0].map((h) => HEADERS[norm(h)] ?? null);
  if (!cols.includes("email") || !cols.includes("firstName") || !cols.includes("lastName")) {
    res.errors.push("Required columns: email, firstName, lastName (optional: phone, jobRole, branch, area, department)."); return res;
  }
  if (rows.length - 1 > maxRows) { res.errors.push(`Too many rows (max ${maxRows}).`); return res; }
  const audiences = await db.audience.findMany();
  const findAudience = (v: string) => { const x = v.trim().toLowerCase(); return x ? audiences.find((a) => [a.key.toLowerCase(), a.nameEn.toLowerCase(), a.nameAr, a.nameEn.toLowerCase().replace(/s$/, "")].includes(x)) : undefined; };
  const student = await db.role.findUniqueOrThrow({ where: { key: "STUDENT" } });
  const touched: string[] = [];
  for (let i = 1; i < rows.length; i++) {
    const rec: Record<string, string> = {};
    cols.forEach((c, j) => { if (c) rec[c] = (rows[i][j] ?? "").trim(); });
    const line = i + 1;
    const email = (rec.email ?? "").toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) { res.errors.push(`Line ${line}: invalid email "${rec.email ?? ""}"`); continue; }
    if (!rec.firstName || !rec.lastName) { res.errors.push(`Line ${line}: first and last name are required`); continue; }
    let audienceId: string | undefined;
    if (rec.jobRole) {
      const a = findAudience(rec.jobRole);
      if (!a) { res.errors.push(`Line ${line}: unknown job role "${rec.jobRole}" (use one of: ${audiences.map((x) => x.key).join(", ")})`); continue; }
      audienceId = a.id;
    }
    const profile = {
      firstName: rec.firstName.slice(0, 60), lastName: rec.lastName.slice(0, 60),
      ...(rec.phone ? { phone: rec.phone.slice(0, 30) } : {}), ...(audienceId ? { audienceId } : {}),
      ...(rec.branch ? { branch: rec.branch.slice(0, 120) } : {}), ...(rec.area ? { area: rec.area.slice(0, 120) } : {}), ...(rec.department ? { department: rec.department.slice(0, 120) } : {}),
    };
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      await db.user.update({ where: { id: existing.id }, data: profile });
      res.updated++; touched.push(existing.id);
    } else {
      const password = tempPassword();
      const u = await db.user.create({ data: { email, ...profile, passwordHash: await hashPassword(password), status: "ACTIVE", emailVerifiedAt: new Date(), mustChangePassword: true, roles: { create: { roleId: student.id } }, studentProfile: { create: {} } } });
      res.created++; touched.push(u.id); res.credentials.push({ email, password });
    }
  }
  for (const id of touched) res.assigned += await syncAssignments({ userId: id });
  return res;
}
