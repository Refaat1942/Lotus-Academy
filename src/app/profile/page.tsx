import { db } from "@/lib/db";
import { getT } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { ActionForm } from "@/components/ui/ActionForm";
import { changePasswordAction, updateProfileAction } from "@/app/actions/profile";

export const metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

export default async function Profile() {
  const me = await requireUser();
  const { t } = await getT();
  const u = await db.user.findUniqueOrThrow({ where: { id: me.id }, include: { studentProfile: true } });
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold text-primary-dark">{t("profile.title")}</h1>
      <section className="card p-6">
        <ActionForm action={updateProfileAction} submitLabel={t("common.save")} buttonClass="btn-primary">
          <div className="grid grid-cols-2 gap-3"><div><label className="label" htmlFor="firstName">{t("auth.firstName")}</label><input id="firstName" name="firstName" defaultValue={u.firstName} required className="input" /></div><div><label className="label" htmlFor="lastName">{t("auth.lastName")}</label><input id="lastName" name="lastName" defaultValue={u.lastName} required className="input" /></div></div>
          <div><label className="label" htmlFor="email">{t("auth.email")}</label><input id="email" value={u.email} disabled className="input bg-background" /></div>
          <div><label className="label" htmlFor="phone">{t("auth.phone")}</label><input id="phone" name="phone" defaultValue={u.phone ?? ""} className="input" /></div>
          <div><label className="label" htmlFor="pharmacy">{t("auth.pharmacy")}</label><input id="pharmacy" name="pharmacy" defaultValue={u.studentProfile?.pharmacyName ?? ""} className="input" /></div>
        </ActionForm>
      </section>
      <section className="card p-6"><h2 className="mb-4 font-semibold">{t("auth.password")}</h2>
        <ActionForm action={changePasswordAction} submitLabel={t("common.save")} buttonClass="btn-secondary">
          <div><label className="label" htmlFor="current">Current password</label><input id="current" name="current" type="password" autoComplete="current-password" required className="input" /></div>
          <div><label className="label" htmlFor="password">New password</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required className="input" /></div>
        </ActionForm>
      </section>
    </div>
  );
}
