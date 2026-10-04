import Link from "next/link";
import { getT } from "@/i18n";

export default async function NotFound() {
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <p className="text-sm font-semibold text-secondary">404</p>
      <h1 className="mt-2 text-3xl font-semibold text-primary-dark">{t("err.notFound")}</h1>
      <p className="mt-3 text-muted">{t("err.notFound.d")}</p>
      <Link href="/" className="btn-primary mt-8">{t("err.home")}</Link>
    </div>
  );
}
