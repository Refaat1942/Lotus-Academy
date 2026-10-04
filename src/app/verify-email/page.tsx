import { getT } from "@/i18n";
import { resendVerificationAction, verifyEmailAction } from "@/app/actions/auth";
import { ActionForm } from "@/components/ui/ActionForm";
import { AuthShell } from "@/components/AuthShell";

export const metadata = { title: "Verify email", robots: { index: false } };

export default async function VerifyEmail({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { t } = await getT();
  return (
    <AuthShell title={t("auth.verify.title")}>
      {sp.token ? (
        // Requires an explicit POST so link scanners/prefetchers cannot consume the one-time token.
        <form action={verifyEmailAction} className="space-y-4"><input type="hidden" name="token" value={sp.token} /><button className="btn-primary w-full" type="submit">{t("auth.verify.title")}</button></form>
      ) : (
        <>
          {sp.sent && <p role="status" className="mb-4 text-sm">{t("auth.verify.sent")}</p>}
          {sp.bad && <p role="alert" className="mb-4 rounded border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">{t("auth.verify.bad")}</p>}
          <ActionForm action={resendVerificationAction} submitLabel={t("auth.verify.resend")} buttonClass="btn-secondary w-full">
            <div><label className="label" htmlFor="email">{t("auth.email")}</label><input id="email" name="email" type="email" required className="input" /></div>
          </ActionForm>
        </>
      )}
    </AuthShell>
  );
}
