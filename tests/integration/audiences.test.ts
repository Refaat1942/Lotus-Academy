import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { enroll } from "@/lib/learning";
import { syncAssignments, visibleCoursesWhere, complianceStatus } from "@/lib/audience";
import { importUsers } from "@/lib/users-admin";
import { complianceRows } from "@/lib/reports";
import { listCourses } from "@/lib/catalog";

const EMAILS = ["aud-bm1@test.local", "aud-ph1@test.local", "aud-new1@test.local", "aud-new2@test.local"];
const noStaff = { permissions: new Set<string>() };

afterAll(async () => {
  const c = await db.course.findUniqueOrThrow({ where: { code: "EG-RET-03" } });
  await db.courseAudience.deleteMany({ where: { courseId: c.id } });
  await db.course.update({ where: { id: c.id }, data: { visibility: "ALL" } });
  await db.user.deleteMany({ where: { email: { in: EMAILS } } });
});

describe("job-role tracks", () => {
  it("seeds the four default job roles", async () => {
    const keys = (await db.audience.findMany({ orderBy: { sortOrder: "asc" } })).map((a) => a.key);
    expect(keys).toEqual(expect.arrayContaining(["PHARMACIST", "BRANCH_MANAGER", "AREA_MANAGER", "DEPARTMENT_MANAGER"]));
  });

  it("imports staff from CSV, rejects bad rows, and assigns mandatory courses with a due date", async () => {
    const bm = await db.audience.findUniqueOrThrow({ where: { key: "BRANCH_MANAGER" } });
    const c = await db.course.findUniqueOrThrow({ where: { code: "EG-RET-03" } });
    await db.course.update({ where: { id: c.id }, data: { visibility: "AUDIENCE" } });
    await db.courseAudience.upsert({ where: { courseId_audienceId: { courseId: c.id, audienceId: bm.id } }, update: { required: true, dueDays: 14 }, create: { courseId: c.id, audienceId: bm.id, required: true, dueDays: 14 } });

    const csv = `email,firstName,lastName,jobRole,branch,area\n${EMAILS[0]},Bm,One,BRANCH_MANAGER,Heliopolis,Cairo East\n${EMAILS[1]},Ph,One,Pharmacists,Heliopolis,Cairo East\nnot-an-email,X,Y,PHARMACIST,,\n${EMAILS[2]},Z,Z,CEO,,\n`;
    const r = await importUsers(csv);
    expect(r.created).toBe(2);
    expect(r.errors).toHaveLength(2);
    expect(r.credentials.map((x) => x.email).sort()).toEqual([EMAILS[0], EMAILS[1]].sort());
    const u = await db.user.findUniqueOrThrow({ where: { email: EMAILS[0] }, include: { enrollments: true } });
    expect(u).toMatchObject({ status: "ACTIVE", mustChangePassword: true, branch: "Heliopolis", audienceId: bm.id });
    const e = u.enrollments.find((x) => x.courseId === c.id)!;
    expect(e.source).toBe("assigned");
    expect(Math.round((e.dueAt!.getTime() - Date.now()) / 86400_000)).toBe(14);
    // idempotent: re-sync creates nothing new; re-import updates instead of duplicating
    expect(await syncAssignments({ courseId: c.id })).toBe(0);
    const again = await importUsers(`email,firstName,lastName,branch\n${EMAILS[0]},Bm,One,Maadi\n`);
    expect(again).toMatchObject({ created: 0, updated: 1 });
    expect((await db.user.findUniqueOrThrow({ where: { email: EMAILS[0] } })).branch).toBe("Maadi");
  });

  it("hides a targeted course from other roles in the catalogue and refuses their enrolment", async () => {
    const c = await db.course.findUniqueOrThrow({ where: { code: "EG-RET-03" } });
    const ph = await db.user.findUniqueOrThrow({ where: { email: EMAILS[1] } });
    const bm = await db.user.findUniqueOrThrow({ where: { email: EMAILS[0] } });
    const forPh = await listCourses({ q: "Retail Operations", visible: visibleCoursesWhere(noStaff, ph.audienceId) });
    const forBm = await listCourses({ q: "Retail Operations", visible: visibleCoursesWhere(noStaff, bm.audienceId) });
    const forPublic = await listCourses({ q: "Retail Operations", visible: visibleCoursesWhere(null, null) });
    expect(forPh.items.map((x) => x.id)).not.toContain(c.id);
    expect(forPublic.items.map((x) => x.id)).not.toContain(c.id);
    expect(forBm.items.map((x) => x.id)).toContain(c.id);
    await expect(enroll(ph.id, c.id)).rejects.toThrow(/not available/);
  });

  it("reports compliance per learner and flags overdue assignments", async () => {
    const c = await db.course.findUniqueOrThrow({ where: { code: "EG-RET-03" } });
    const bm = await db.user.findUniqueOrThrow({ where: { email: EMAILS[0] } });
    await db.enrollment.updateMany({ where: { userId: bm.id, courseId: c.id }, data: { dueAt: new Date(Date.now() - 86400_000) } });
    const rows = await complianceRows({ courseId: c.id, branch: "maadi" });
    expect(rows).toHaveLength(1);
    expect(rows[0].compliance).toBe("OVERDUE");
    expect(complianceStatus({ status: "COMPLETED", dueAt: new Date(0) }, 100)).toBe("COMPLETED");
    expect(complianceStatus({ status: "ACTIVE", dueAt: null }, 40)).toBe("IN_PROGRESS");
  });
});
