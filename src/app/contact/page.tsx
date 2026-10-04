import { db } from "@/lib/db";
import { getT } from "@/i18n";
import { PageHeader } from "@/components/ui";
export const metadata = { title: "Contact" };
export const dynamic = "force-dynamic";
export default async function Contact() {
  const { t } = await getT();
  const s = await db.systemSetting.findUnique({ where: { key: "contact.email" } });
  const email = typeof s?.value === "string" ? s.value : "";
  return (<><PageHeader title={t("contact.title")} lead={t("contact.lead")} /><div className="mx-auto max-w-3xl px-4 py-12 sm:px-6"><div className="card p-6"><div className="text-sm text-muted">{t("contact.email")}</div><a className="text-lg font-semibold text-primary" href={`mailto:${email}`}>{email}</a></div></div></>);
}
