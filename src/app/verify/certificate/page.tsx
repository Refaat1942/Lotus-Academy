import { redirect } from "next/navigation";
import { getT } from "@/i18n";
import { PageHeader } from "@/components/ui";
export const metadata = { title: "Verify a certificate" };

export default async function VerifyForm() {
  const { t } = await getT();
  async function go(fd: FormData) {
    "use server";
    const id = String(fd.get("id") ?? "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
    if (id) redirect(`/verify/certificate/${id}`);
  }
  return (<><PageHeader title={t("cert.verifyTitle")} /><div className="mx-auto max-w-lg px-4 py-12"><form action={go} className="card space-y-4 p-6"><label className="label" htmlFor="id">{t("cert.enterId")}</label><input id="id" name="id" required maxLength={40} placeholder="LA-XXXX-XXXX-XXXX" className="input font-mono" /><button className="btn-primary" type="submit">{t("cert.verifyTitle")}</button></form></div></>);
}
