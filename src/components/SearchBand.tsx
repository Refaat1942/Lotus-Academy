import { Search } from "lucide-react";
import { getT } from "@/i18n";

/** Pill search bar on a brand-green band (mirrors the lotusonline.com header pattern). */
export async function SearchBand({ defaultValue }: { defaultValue?: string }) {
  const { t } = await getT();
  return (
    <div className="bg-primary">
      <form action="/courses" method="get" role="search" className="mx-auto max-w-4xl px-4 py-4 sm:px-6">
        <label htmlFor="band-q" className="sr-only">{t("courses.search")}</label>
        <div className="flex items-center gap-2 rounded-full bg-white p-1.5 ps-5 shadow-lift ring-4 ring-white/25">
          <Search size={18} className="shrink-0 text-muted" aria-hidden />
          <input id="band-q" name="q" defaultValue={defaultValue} maxLength={100} placeholder={t("search.placeholder")} className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted" />
          <button type="submit" className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark">{t("common.search")}</button>
        </div>
      </form>
    </div>
  );
}
