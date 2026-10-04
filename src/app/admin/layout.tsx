import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getT, type MessageKey } from "@/i18n";
import { requireUser } from "@/lib/auth";
import type { PermissionKey } from "@/lib/permissions";
import { AdminNav, type NavGroup } from "@/components/AdminNav";

type Item = [href: string, key: MessageKey, perm: PermissionKey, icon: string];
const GROUPS: [string, Item[]][] = [
  ["Dashboard", [["/admin", "admin.overview", "courses.read", "overview"]]],
  ["People", [
    ["/admin/users", "admin.users", "users.read", "users"],
    ["/admin/users?role=STUDENT", "admin.students", "users.read", "students"],
    ["/admin/users?role=INSTRUCTOR", "admin.instructors", "users.read", "instructors"],
  ]],
  ["Learning", [
    ["/admin/courses", "admin.courses", "courses.read", "courses"],
    ["/admin/categories", "admin.categories", "courses.write", "categories"],
    ["/admin/quizzes", "admin.quizzes", "courses.read", "quizzes"],
    ["/admin/enrollments", "admin.enrollments", "enrollments.read", "enrollments"],
    ["/admin/certificates", "admin.certificates", "certificates.read", "certificates"],
  ]],
  ["Insights", [["/admin/reports", "admin.reports", "reports.read", "reports"]]],
  ["System", [
    ["/admin/notifications", "admin.notifications", "settings.write", "notifications"],
    ["/admin/emails", "admin.emails", "emails.read", "emails"],
    ["/admin/audit", "admin.audit", "audit.read", "audit"],
    ["/admin/settings", "admin.settings", "settings.write", "settings"],
  ]],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { t } = await getT();
  const groups: NavGroup[] = GROUPS.map(([label, items]) => ({
    label,
    items: items.filter(([, , p]) => user.permissions.has(p)).map(([href, key, , icon]) => ({ href, label: t(key), icon })),
  })).filter((g) => g.items.length);
  if (!groups.length) redirect("/dashboard?denied=1");
  return (
    <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[250px_1fr]">
      <aside className="lg:sticky lg:top-28 lg:self-start">
        <Suspense fallback={null}><AdminNav groups={groups} title={t("admin.title")} /></Suspense>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
