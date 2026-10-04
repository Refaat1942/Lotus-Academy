import Link from "next/link";
import { redirect } from "next/navigation";
import { getT } from "@/i18n";
import { getCurrentUser } from "@/lib/auth";
import { loginAction } from "@/app/actions/auth";
import { ActionForm } from "@/components/ui/ActionForm";
import { AuthShell } from "@/components/AuthShell";

export const metadata = { title: "Sign in" };

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { t } = await getT();
  if (await getCurrentUser()) redirect("/dashboard");
  const notice = sp.verified ? t("auth.verify.ok") : sp.reset ? t("auth.reset.done") : null;
  return (
    <AuthShell title={t("auth.login.title")} lead={t("auth.login.lead")} footer={<>{t("auth.noAccount")} <Link className="font-semibold text-primary" href="/register">{t("nav.register")}</Link></>}>
      {notice && <p role="status" className="mb-4 rounded border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{notice}</p>}
      <ActionForm action={loginAction} submitLabel={t("nav.login")}>
        <input type="hidden" name="next" value={sp.next ?? ""} />
        <div><label className="label" htmlFor="email">{t("auth.email")}</label><input id="email" name="email" type="email" autoComplete="email" required className="input" /></div>
        <div><label className="label" htmlFor="password">{t("auth.password")}</label><input id="password" name="password" type="password" autoComplete="current-password" required className="input" /></div>
        <div className="text-end text-sm"><Link className="text-primary" href="/forgot-password">{t("auth.forgot")}</Link></div>
      </ActionForm>
    </AuthShell>
  );
}
