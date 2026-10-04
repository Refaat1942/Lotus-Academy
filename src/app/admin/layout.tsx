import Link from "next/link";
import { getT, type MessageKey } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { PermissionKey } from "@/lib/permissions";

const NAV: [string, MessageKey, PermissionKey][] = [
  ["/admin", "admin.overview", "courses.read"],
  ["/admin/users", "admin.users", "users.read"],
  ["/admin/users?role=STUDENT", "admin.students", "users.read"],
  ["/admin/users?role=INSTRUCTOR", "admin.instructors", "users.read"],
  ["/admin/courses", "admin.courses", "courses.read"],
  ["/admin/categories", "admin.categories", "courses.write"],
  ["/admin/quizzes", "admin.quizzes", "courses.read"],
  ["/admin/certificates", "admin.certificates", "certificates.read"],
  ["/admin/enrollments", "admin.enrollments", "enrollments.read"],
  ["/admin/reports", "admin.reports", "reports.read"],
  ["/admin/notifications", "admin.notifications", "settings.write"],
  ["/admin/emails", "admin.emails", "emails.read"],
  ["/admin/audit", "admin.audit", "audit.read"],
  ["/admin/settings", "admin.settings", "settings.write"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const items = NAV.filter(([, , p]) => user.permissions.has(p));
  if (!items.length) redirect("/dashboard?denied=1");
  const { t } = await getT();
  return (
    <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_1fr]">
      <nav aria-label="Admin" className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-2 hidden px-3 text-xs font-semibold uppercase tracking-widest text-muted lg:block">{t("admin.title")}</p>
        <ul className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
          {items.map(([href, key]) => (
            <li key={href} className="shrink-0"><Link href={href} className="block whitespace-nowrap rounded px-3 py-2 text-sm font-medium text-text/80 hover:bg-primary-light hover:text-primary-dark">{t(key)}</Link></li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
