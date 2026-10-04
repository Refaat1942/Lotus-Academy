import { getT } from "@/i18n";
import { PageHeader } from "@/components/ui";
export const metadata = { title: "About" };
export default async function About() {
  const { t } = await getT();
  return (<><PageHeader title={t("about.title")} /><div className="mx-auto max-w-3xl space-y-5 px-4 py-12 text-lg leading-8 text-text/90 sm:px-6"><p>{t("about.p1")}</p><p>{t("about.p2")}</p><p>{t("about.p3")}</p></div></>);
}
