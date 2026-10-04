import Image from "next/image";
import Link from "next/link";
import { getT } from "@/i18n";

export async function Logo({ light = false }: { light?: boolean }) {
  const { t } = await getT();
  return (
    <Link href="/" className="flex items-center gap-3" aria-label={t("brand.name")}>
      <Image src="/brand/lotus-mark.svg" alt="" width={40} height={40} priority unoptimized />
      <span className="leading-tight">
        <span className={`block text-base font-bold tracking-wide ${light ? "text-white" : "text-primary-dark"}`}>{t("brand.name")}</span>
        <span className={`hidden text-[11px] sm:block ${light ? "text-white/80" : "text-muted"}`}>{t("brand.subtitle")}</span>
      </span>
    </Link>
  );
}
