import Link from "next/link";
import { getT } from "@/i18n";
import { registerAction } from "@/app/actions/auth";
import { ActionForm } from "@/components/ui/ActionForm";
import { AuthShell } from "@/components/AuthShell";

export const metadata = { title: "Create account" };

export default async function Register() {
  const { t } = await getT();
  return (
    <AuthShell title={t("auth.register.title")} footer={<>{t("auth.haveAccount")} <Link className="font-semibold text-primary" href="/login">{t("nav.login")}</Link></>}>
      <ActionForm action={registerAction} submitLabel={t("nav.register")}>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="firstName">{t("auth.firstName")}</label><input id="firstName" name="firstName" required maxLength={60} autoComplete="given-name" className="input" /></div>
          <div><label className="label" htmlFor="lastName">{t("auth.lastName")}</label><input id="lastName" name="lastName" required maxLength={60} autoComplete="family-name" className="input" /></div>
        </div>
        <div><label className="label" htmlFor="email">{t("auth.email")}</label><input id="email" name="email" type="email" required autoComplete="email" className="input" /></div>
        <div><label className="label" htmlFor="password">{t("auth.password")}</label><input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" aria-describedby="pwhint" className="input" /><p id="pwhint" className="mt-1 text-xs text-muted">{t("auth.passwordHint")}</p></div>
        <div><label className="label" htmlFor="phone">{t("auth.phone")}</label><input id="phone" name="phone" type="tel" maxLength={30} autoComplete="tel" className="input" /></div>
        <div><label className="label" htmlFor="pharmacy">{t("auth.pharmacy")}</label><input id="pharmacy" name="pharmacy" maxLength={120} className="input" /></div>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="terms" required className="mt-1" /><span>{t("auth.terms")}</span></label>
      </ActionForm>
    </AuthShell>
  );
}
