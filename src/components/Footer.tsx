import Link from "next/link";
import { Logo } from "./Logo";
import { getT } from "@/i18n";

export async function Footer() {
  const { t } = await getT();
  return (
    <footer className="mt-24 bg-primary-dark text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3">
        <div>
          <Logo light />
          <p className="mt-4 max-w-xs text-sm text-white/75">{t("footer.disclaimer")}</p>
        </div>
        <nav aria-label="Explore" className="text-sm">
          <h2 className="mb-3 font-semibold">{t("footer.explore")}</h2>
          <ul className="space-y-2 text-white/80">
            <li><Link href="/courses" className="hover:text-white">{t("nav.courses")}</Link></li>
            <li><Link href="/categories" className="hover:text-white">{t("nav.categories")}</Link></li>
            <li><Link href="/instructors" className="hover:text-white">{t("nav.instructors")}</Link></li>
            <li><Link href="/verify/certificate" className="hover:text-white">{t("cert.verifyTitle")}</Link></li>
          </ul>
        </nav>
        <nav aria-label="Academy" className="text-sm">
          <h2 className="mb-3 font-semibold">{t("footer.company")}</h2>
          <ul className="space-y-2 text-white/80">
            <li><Link href="/about" className="hover:text-white">{t("nav.about")}</Link></li>
            <li><Link href="/faq" className="hover:text-white">{t("nav.faq")}</Link></li>
            <li><Link href="/contact" className="hover:text-white">{t("nav.contact")}</Link></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/15 py-5 text-center text-xs text-white/70">© {new Date().getFullYear()} Lotus Academy. {t("footer.rights")}</div>
    </footer>
  );
}
