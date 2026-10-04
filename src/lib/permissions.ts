export const PERMISSIONS = [
  "users.read", "users.write", "roles.write",
  "courses.read", "courses.write", "courses.publish",
  "lessons.write", "quizzes.write",
  "enrollments.read", "enrollments.write",
  "certificates.read", "certificates.write",
  "reports.read", "settings.write", "audit.read", "emails.read",
] as const;
export type PermissionKey = (typeof PERMISSIONS)[number];

export const ROLES: Record<string, { name: string; permissions: readonly PermissionKey[] | "*" }> = {
  SUPER_ADMIN: { name: "Super Admin", permissions: "*" },
  ADMIN: {
    name: "Admin",
    permissions: PERMISSIONS.filter((p) => p !== "roles.write"),
  },
  INSTRUCTOR: {
    name: "Instructor",
    permissions: ["courses.read", "courses.write", "lessons.write", "quizzes.write", "enrollments.read", "reports.read"],
  },
  CONTENT_MANAGER: {
    name: "Content Manager",
    permissions: ["courses.read", "courses.write", "courses.publish", "lessons.write", "quizzes.write"],
  },
  SUPPORT: { name: "Support", permissions: ["users.read", "courses.read", "enrollments.read", "certificates.read", "emails.read"] },
  STUDENT: { name: "Student", permissions: [] },
};

/** Roles that may open the admin area at all (still checked per-permission inside). */
export const STAFF_PERMISSION: PermissionKey = "courses.read";
