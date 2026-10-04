import Image from "next/image";
import Link from "next/link";
import { getT } from "@/i18n";
import { getBrand } from "@/lib/brand";

/** Uses the admin-uploaded logo when present, otherwise the built-in default mark + wordmark. */
export async function Logo({ light = false }: { light?: boolean }) {
  const { t } = await getT();
  const brand = await getBrand();
  return (
    <Link href="/" className="flex items-center gap-3" aria-label={t("brand.name")}>
      {brand.logo ? (
        // Plain <img>: user-supplied formats (SVG/GIF/AVIF…) must not go through the image optimizer.
        <span className={light ? "rounded-xl bg-white px-3 py-2" : ""}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/brand/logo?v=${brand.logo}`} alt={t("brand.name")} className="h-10 w-auto max-w-[180px] object-contain" />
        </span>
      ) : (
        <>
          <Image src="/brand/lotus-mark.svg" alt="" width={42} height={42} priority unoptimized className={light ? "rounded-full bg-white p-0.5" : ""} />
          <span className={`text-xl font-extrabold tracking-wide ${light ? "text-white" : "text-primary"}`}>LOTUS</span>
        </>
      )}
      <span className={`hidden border-s ps-3 leading-tight sm:block ${light ? "border-white/30" : "border-border"}`}>
        <span className={`block text-sm font-bold uppercase tracking-[0.18em] ${light ? "text-white" : "text-primary-dark"}`}>{t("brand.academy")}</span>
        <span className={`hidden text-[11px] 2xl:block ${light ? "text-white/75" : "text-muted"}`}>{t("brand.subtitle")}</span>
      </span>
    </Link>
  );
}
