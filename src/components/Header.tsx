import Link from "next/link";
import { Menu } from "lucide-react";
import { Logo } from "./Logo";
import { getT } from "@/i18n";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { toggleLocaleAction } from "@/app/actions/locale";

const link = "rounded-lg px-3 py-2 text-sm font-semibold text-text/80 transition-colors hover:bg-primary-light hover:text-primary-dark";

export async function Header() {
  const { t } = await getT();
  const user = await getCurrentUser();
  const links = [
    ["/courses", t("nav.courses")], ["/categories", t("nav.categories")], ["/instructors", t("nav.instructors")],
    ["/about", t("nav.about")], ["/faq", t("nav.faq")], ["/contact", t("nav.contact")],
  ] as const;
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 focus:rounded focus:bg-primary focus:px-3 focus:py-2 focus:text-white">{t("nav.skip")}</a>
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 xl:flex">
          {links.map(([href, label]) => <Link key={href} href={href} className={link}>{label}</Link>)}
        </nav>
        <div className="flex items-center gap-2">
          <form action={toggleLocaleAction}><button className="btn-secondary !px-3 !py-2 text-sm" type="submit" lang={t("nav.language") === "English" ? "en" : "ar"}>{t("nav.language")}</button></form>
          {user ? (
            <>
              {isStaff(user) && <Link href="/admin" className="btn-secondary hidden md:inline-flex">{t("nav.admin")}</Link>}
              <Link href="/dashboard" className="btn-primary hidden md:inline-flex">{t("nav.dashboard")}</Link>
              <Link href="/profile" className="btn-secondary hidden lg:inline-flex">{t("profile.title")}</Link>
              <form action={logoutAction} className="hidden lg:block"><button className="btn-secondary" type="submit">{t("nav.logout")}</button></form>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-secondary hidden md:inline-flex">{t("nav.login")}</Link>
              <Link href="/register" className="btn-primary hidden md:inline-flex">{t("nav.register")}</Link>
            </>
          )}
          <details className="relative xl:hidden">
            <summary className="btn-secondary cursor-pointer list-none !px-3" aria-label="Menu"><Menu size={18} aria-hidden /></summary>
            <div className="absolute end-0 mt-2 w-64 rounded-2xl border border-border bg-surface p-3 shadow-lift">
              <nav aria-label="Mobile" className="flex flex-col gap-1 text-sm">
                {links.map(([href, label]) => <Link key={href} href={href} className="rounded-lg px-3 py-2 hover:bg-primary-light">{label}</Link>)}
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
              </nav>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
