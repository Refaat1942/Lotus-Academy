import Link from "next/link";
import { db } from "@/lib/db";
import { getT } from "@/i18n";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/auth";
import { CheckCircle2, XCircle } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Certificate verification", robots: { index: false } };

export default async function Verify({ params }: { params: Promise<{ certId: string }> }) {
  const { certId } = await params;
  const { t } = await getT();
  const allowed = await rateLimit(`verify:${await clientIp()}`, 60, 600); // blunt ID enumeration
  const cert = allowed && /^LA-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(certId)
    ? await db.certificate.findUnique({ where: { publicId: certId } }) : null;
  if (cert) await db.certificate.update({ where: { id: cert.id }, data: { verifiedCount: { increment: 1 } } });
  const valid = cert && !cert.revokedAt;
  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <div className={`card p-8 text-center ${valid ? "border-success/40" : "border-error/40"}`} role="status">
        {valid ? <CheckCircle2 className="mx-auto text-success" size={44} aria-hidden /> : <XCircle className="mx-auto text-error" size={44} aria-hidden />}
        <h1 className="mt-4 text-2xl font-semibold">{valid ? t("cert.verified") : cert?.revokedAt ? t("cert.revoked") : t("cert.invalid")}</h1>
        {valid ? (
          <dl className="mt-6 space-y-3 text-start text-sm">
            <div><dt className="text-muted">{t("cert.certify")}</dt><dd className="font-semibold">{cert.recipientName}</dd></div>
            <div><dt className="text-muted">{t("cert.completed")}</dt><dd className="font-semibold">{cert.courseTitle}</dd></div>
            <div><dt className="text-muted">{t("cert.issued")}</dt><dd>{cert.issuedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</dd></div>
            <div><dt className="text-muted">{t("cert.id")}</dt><dd className="font-mono">{cert.publicId}</dd></div>
          </dl>
        ) : <p className="mt-3 text-muted">{t("cert.invalid.d")}</p>}
        <Link href="/verify/certificate" className="btn-secondary mt-8">{t("cert.verifyTitle")}</Link>
      </div>
    </div>
  );
}
