import { getT } from "@/i18n";
import { resetPasswordAction } from "@/app/actions/auth";
import { ActionForm } from "@/components/ui/ActionForm";
import { AuthShell } from "@/components/AuthShell";

export const metadata = { title: "Reset password", robots: { index: false } };

export default async function Reset({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const { t } = await getT();
  return (
    <AuthShell title={t("auth.reset.title")}>
      <ActionForm action={resetPasswordAction} submitLabel={t("common.save")}>
        <input type="hidden" name="token" value={token ?? ""} />
        <div><label className="label" htmlFor="password">{t("auth.password")}</label><input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" className="input" /><p className="mt-1 text-xs text-muted">{t("auth.passwordHint")}</p></div>
      </ActionForm>
    </AuthShell>
  );
}
