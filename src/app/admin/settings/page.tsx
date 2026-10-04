import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/i18n";
import { AdminTitle } from "@/components/admin";
import { ActionForm } from "@/components/ui/ActionForm";
import { saveSettingsAction } from "@/app/actions/admin";

export const dynamic = "force-dynamic";
type Bi = { en?: string; ar?: string };

export default async function Settings() {
  await requirePermission("settings.write");
  const { t } = await getT();
  const rows = await db.systemSetting.findMany();
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, unknown>;
  const sub = (s["brand.subtitle"] ?? {}) as Bi;
  const iss = (s["certificate.issuer"] ?? {}) as Bi;
  return (
    <>
      <AdminTitle title={t("admin.settings")} />
      <section className="card max-w-2xl p-5">
        <ActionForm action={saveSettingsAction} submitLabel={t("common.save")} buttonClass="btn-primary">
          <div><label className="label" htmlFor="subtitleEn">Academy subtitle (EN)</label><input id="subtitleEn" name="subtitleEn" defaultValue={sub.en} className="input" /></div>
          <div><label className="label" htmlFor="subtitleAr">Academy subtitle (AR)</label><input id="subtitleAr" name="subtitleAr" dir="rtl" defaultValue={sub.ar} className="input" /></div>
          <div><label className="label" htmlFor="issuerEn">Certificate issuer (EN)</label><input id="issuerEn" name="issuerEn" defaultValue={iss.en} className="input" /></div>
          <div><label className="label" htmlFor="issuerAr">Certificate issuer (AR)</label><input id="issuerAr" name="issuerAr" dir="rtl" defaultValue={iss.ar} className="input" /></div>
          <div><label className="label" htmlFor="contactEmail">Contact email</label><input id="contactEmail" name="contactEmail" type="email" defaultValue={typeof s["contact.email"] === "string" ? (s["contact.email"] as string) : ""} className="input" /></div>
        </ActionForm>
      </section>
    </>
  );
}
