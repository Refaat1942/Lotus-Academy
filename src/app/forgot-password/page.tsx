import Link from "next/link";
import { getT } from "@/i18n";
import { forgotPasswordAction } from "@/app/actions/auth";
import { ActionForm } from "@/components/ui/ActionForm";
import { AuthShell } from "@/components/AuthShell";

export const metadata = { title: "Forgot password" };

export default async function Forgot() {
  const { t } = await getT();
  return (
    <AuthShell title={t("auth.forgot.title")} lead={t("auth.forgot.lead")} footer={<Link className="text-primary" href="/login">{t("nav.login")}</Link>}>
      <ActionForm action={forgotPasswordAction} submitLabel={t("common.save")}>
        <div><label className="label" htmlFor="email">{t("auth.email")}</label><input id="email" name="email" type="email" required className="input" /></div>
      </ActionForm>
    </AuthShell>
  );
}
