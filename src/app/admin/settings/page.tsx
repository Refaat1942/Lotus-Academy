import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/i18n";
import { AdminTitle } from "@/components/admin";
import { ActionForm } from "@/components/ui/ActionForm";
import { removeBrandAction, saveSettingsAction, uploadBrandAction } from "@/app/actions/admin";
import { getBrand } from "@/lib/brand";

export const dynamic = "force-dynamic";
type Bi = { en?: string; ar?: string };

export default async function Settings() {
  await requirePermission("settings.write");
  const { t } = await getT();
  const brand = await getBrand();
  const rows = await db.systemSetting.findMany();
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, unknown>;
  const sub = (s["brand.subtitle"] ?? {}) as Bi;
  const iss = (s["certificate.issuer"] ?? {}) as Bi;
  return (
    <>
      <AdminTitle title={t("admin.settings")} />
      <section className="card mb-8 max-w-2xl p-5">
        <h2 className="mb-1 font-semibold">Brand assets</h2>
        <p className="mb-5 text-sm text-muted">Upload your logo in any common image format (PNG, JPG, WebP, GIF, AVIF, SVG, ICO, BMP — up to 2 MB). It appears in the header, footer, login pages and certificates. A transparent PNG or SVG works best.</p>
        {([["logo", "Logo", brand.logo], ["favicon", "Favicon (browser tab icon)", brand.favicon]] as const).map(([slot, label, v]) => (
          <div key={slot} className="mb-6 border-t border-border pt-5 first:border-0 first:pt-0">
            <h3 className="mb-3 text-sm font-medium">{label}</h3>
            {v ? (
              <div className="mb-3 flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/brand/${slot}?v=${v}`} alt={`Current ${label}`} className="h-14 max-w-[200px] rounded-lg border border-border bg-background object-contain p-2" />
                <form action={removeBrandAction}><input type="hidden" name="slot" value={slot} /><button className="btn-secondary !text-error" type="submit">Remove</button></form>
              </div>
            ) : <p className="mb-3 text-sm text-muted">Using the default mark.</p>}
            <ActionForm action={uploadBrandAction} submitLabel="Upload" buttonClass="btn-primary">
              <input type="hidden" name="slot" value={slot} />
              <input name="file" type="file" required accept="image/*,.svg,.ico,.avif" aria-label={`${label} file`} className="input" />
            </ActionForm>
          </div>
        ))}
      </section>
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
