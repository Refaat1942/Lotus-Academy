import Link from "next/link";
import { ChevronDown, Menu, Search } from "lucide-react";
import { Logo } from "./Logo";
import { StickyHeader } from "./StickyHeader";
import { categoryIcon } from "./icons";
import { db } from "@/lib/db";
import { getT, pick } from "@/i18n";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { toggleLocaleAction } from "@/app/actions/locale";

const navLink = "relative px-3 py-6 text-[15px] font-semibold text-text transition-colors after:absolute after:inset-x-3 after:bottom-4 after:h-0.5 after:origin-left after:scale-x-0 after:bg-primary after:transition-transform hover:text-primary hover:after:scale-x-100 focus-visible:after:scale-x-100 rtl:after:origin-right";

export async function Header() {
  const { t, locale } = await getT();
  const user = await getCurrentUser();
  const categories = await db.courseCategory.findMany({ orderBy: { sortOrder: "asc" }, include: { courses: { where: { status: "PUBLISHED", deletedAt: null }, orderBy: { sortOrder: "asc" }, select: { slug: true, titleEn: true, titleAr: true }, take: 3 } } });
  const links = [["/categories", t("nav.categories")], ["/instructors", t("nav.instructors")], ["/about", t("nav.about")], ["/faq", t("nav.faq")], ["/contact", t("nav.contact")]] as const;

  return (
    <StickyHeader>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 focus:rounded focus:bg-primary focus:px-3 focus:py-2 focus:text-white">{t("nav.skip")}</a>

      {/* Utility bar */}
      <div className="hidden bg-primary-dark text-xs text-white/90 md:block">
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-between px-4 sm:px-6">
          <span>{t("brand.subtitle")}</span>
          <div className="flex items-center gap-5">
            <Link href="/verify/certificate" className="hover:underline">{t("cert.verifyTitle")}</Link>
            {user ? (
              <>
                {isStaff(user) && <Link href="/admin" className="hover:underline">{t("nav.admin")}</Link>}
                <Link href="/profile" className="hover:underline">{t("profile.title")}</Link>
                <form action={logoutAction}><button type="submit" className="hover:underline">{t("nav.logout")}</button></form>
              </>
            ) : (
              <Link href="/login" className="hover:underline">{t("nav.login")}</Link>
            )}
            <form action={toggleLocaleAction}><button type="submit" className="font-semibold hover:underline" lang={t("nav.language") === "English" ? "en" : "ar"}>{t("nav.language")}</button></form>
          </div>
        </div>
      </div>

      {/* Main bar */}
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="hidden items-center xl:flex">
          {/* Mega menu: opens on hover and on keyboard focus, no JavaScript */}
          <div className="group">
            <Link href="/courses" className={`${navLink} inline-flex items-center gap-1`} aria-haspopup="true">{t("nav.courses")} <ChevronDown size={14} aria-hidden /></Link>
            <div className="invisible absolute inset-x-0 top-full border-t border-border bg-surface opacity-0 shadow-lift transition-all duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              <div className="mx-auto grid max-w-7xl gap-x-8 gap-y-6 px-6 py-8 lg:grid-cols-4">
                {categories.map((c) => {
                  const Icon = categoryIcon(c.slug);
                  return (
                    <div key={c.id}>
                      <Link href={`/courses?category=${c.slug}`} className="mb-2 flex items-center gap-2 text-sm font-bold text-primary-dark hover:text-primary"><Icon size={18} aria-hidden />{pick(locale, c.nameEn, c.nameAr)}</Link>
                      <ul className="space-y-1.5 border-s-2 border-primary-light ps-4 text-sm">
                        {c.courses.map((k) => <li key={k.slug}><Link href={`/courses/${k.slug}`} className="text-muted hover:text-primary hover:underline">{pick(locale, k.titleEn, k.titleAr)}</Link></li>)}
                      </ul>
                    </div>
                  );
                })}
                <div className="flex items-end lg:col-span-4"><Link href="/courses" className="text-sm font-bold text-primary underline-offset-4 hover:underline">{t("home.cta1")} →</Link></div>
              </div>
            </div>
          </div>
          {links.map(([href, label]) => <Link key={href} href={href} className={navLink}>{label}</Link>)}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/courses" className="flex h-10 w-10 items-center justify-center rounded-full text-text hover:bg-primary-light" aria-label={t("common.search")}><Search size={20} aria-hidden /></Link>
          {user ? <Link href="/dashboard" className="btn-primary hidden md:inline-flex">{t("nav.dashboard")}</Link> : <Link href="/register" className="btn-primary hidden md:inline-flex">{t("nav.register")}</Link>}
          <details className="relative xl:hidden">
            <summary className="btn-secondary cursor-pointer list-none !px-3" aria-label="Menu"><Menu size={18} aria-hidden /></summary>
            <div className="absolute end-0 mt-2 max-h-[80vh] w-72 overflow-y-auto rounded-2xl border border-border bg-surface p-3 shadow-lift">
              <nav aria-label="Mobile" className="flex flex-col gap-1 text-sm">
                <Link href="/courses" className="rounded-lg px-3 py-2 font-semibold hover:bg-primary-light">{t("nav.courses")}</Link>
                {categories.map((c) => <Link key={c.id} href={`/courses?category=${c.slug}`} className="rounded-lg px-3 py-1.5 ps-6 text-muted hover:bg-primary-light">{pick(locale, c.nameEn, c.nameAr)}</Link>)}
                {links.map(([href, label]) => <Link key={href} href={href} className="rounded-lg px-3 py-2 font-semibold hover:bg-primary-light">{label}</Link>)}
                <hr className="my-1 border-border" />
                {user ? (
                  <>
                    <Link href="/dashboard" className="rounded-lg px-3 py-2 hover:bg-primary-light">{t("nav.dashboard")}</Link>
                    <Link href="/profile" className="rounded-lg px-3 py-2 hover:bg-primary-light">{t("profile.title")}</Link>
                    {isStaff(user) && <Link href="/admin" className="rounded-lg px-3 py-2 hover:bg-primary-light">{t("nav.admin")}</Link>}
                    <form action={logoutAction}><button className="w-full rounded-lg px-3 py-2 text-start hover:bg-primary-light" type="submit">{t("nav.logout")}</button></form>
                  </>
                ) : (
                  <>
                    <Link href="/login" className="rounded-lg px-3 py-2 hover:bg-primary-light">{t("nav.login")}</Link>
                    <Link href="/register" className="rounded-lg px-3 py-2 font-semibold text-primary hover:bg-primary-light">{t("nav.register")}</Link>
                  </>
                )}
                <form action={toggleLocaleAction}><button className="w-full rounded-lg px-3 py-2 text-start font-semibold hover:bg-primary-light" type="submit">{t("nav.language")}</button></form>
              </nav>
            </div>
          </details>
        </div>
      </div>
    </StickyHeader>
  );
}
