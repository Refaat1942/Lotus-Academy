import { getT, type MessageKey } from "@/i18n";
import { PageHeader } from "@/components/ui";
export const metadata = { title: "FAQ" };
export default async function Faq() {
  const { t } = await getT();
  return (<><PageHeader title={t("faq.title")} /><div className="mx-auto max-w-3xl px-4 py-12 sm:px-6"><div className="divide-y divide-border rounded-lg border border-border bg-surface">
    {[1, 2, 3, 4, 5].map((n) => <details key={n} className="p-5"><summary className="cursor-pointer font-medium">{t(`faq.q${n}` as MessageKey)}</summary><p className="mt-2 text-sm text-muted">{t(`faq.a${n}` as MessageKey)}</p></details>)}
  </div></div></>);
}
