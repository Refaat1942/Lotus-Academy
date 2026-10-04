"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Activity, Award, BarChart3, Bell, BookOpen, ClipboardList, GraduationCap, LayoutDashboard, Mail, Settings, ShieldCheck, Tags, UserCog, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = { overview: LayoutDashboard, users: Users, students: GraduationCap, instructors: UserCog, courses: BookOpen, categories: Tags, quizzes: ClipboardList, certificates: Award, enrollments: Activity, reports: BarChart3, notifications: Bell, emails: Mail, audit: ShieldCheck, settings: Settings };

export interface NavGroup { label: string; items: { href: string; label: string; icon: string }[] }

export function AdminNav({ groups, title }: { groups: NavGroup[]; title: string }) {
  const path = usePathname();
  const role = useSearchParams().get("role");
  const isActive = (href: string) => {
    const [base, q] = href.split("?");
    if (base === "/admin") return path === "/admin";
    if (base === "/admin/users") return path === base && (q ? q === `role=${role}` : !role);
    return path === base || path.startsWith(base + "/");
  };
  return (
    <nav aria-label={title} className="rounded-2xl border border-border bg-surface p-3 shadow-card lg:p-4">
      <p className="mb-3 hidden px-3 pt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-muted lg:block">{title}</p>
      <div className="flex gap-1 overflow-x-auto lg:block lg:space-y-5 lg:overflow-visible">
        {groups.map((g) => (
          <div key={g.label} className="flex shrink-0 gap-1 lg:block">
            <p className="mb-1 hidden px-3 text-xs font-semibold text-muted lg:block">{g.label}</p>
            <ul className="flex gap-1 lg:block lg:space-y-0.5">
              {g.items.map((it) => {
                const Icon = ICONS[it.icon] ?? LayoutDashboard;
                const active = isActive(it.href);
                return (
                  <li key={it.href}>
                    <Link href={it.href} aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active ? "bg-primary text-white shadow-sm" : "text-text/80 hover:bg-primary-light hover:text-primary-dark"}`}>
                      <Icon size={17} aria-hidden className="shrink-0" />{it.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
