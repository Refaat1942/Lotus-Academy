import { notFound } from "next/navigation";
import Image from "next/image";
import { db } from "@/lib/db";
import { getT } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Certificate", robots: { index: false } };

export default async function CertificatePage({ params }: { params: Promise<{ certId: string }> }) {
  const { certId } = await params;
  const { t } = await getT();
  const user = await requireUser();
  const cert = await db.certificate.findFirst({ where: { publicId: certId, userId: user.id }, include: { course: true } }); // owner-only
  if (!cert) notFound();
  const issuer = await db.systemSetting.findUnique({ where: { key: "certificate.issuer" } });
  const issuerName = (issuer?.value as { en?: string } | null)?.en ?? "Lotus Academy";
  const url = `${env.appUrl()}/verify/certificate/${cert.publicId}`;
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-4 flex justify-end print:hidden"><PrintButton label={t("cert.print")} /></div>
      <div className="relative border-[10px] border-double border-primary bg-surface p-10 text-center shadow-card sm:p-16" dir="ltr">
        <Image src="/brand/lotus-mark.svg" alt="" width={64} height={64} className="mx-auto" unoptimized />
        <p className="mt-3 text-sm font-semibold uppercase tracking-[0.3em] text-primary-dark">LOTUS ACADEMY</p>
        <h1 className="mt-8 font-serif text-4xl text-primary-dark">{t("cert.title")}</h1>
        <p className="mt-8 text-muted">{t("cert.certify")}</p>
        <p className="mt-3 font-serif text-4xl">{cert.recipientName}</p>
        <p className="mt-6 text-muted">{t("cert.completed")}</p>
        <p className="mt-3 text-2xl font-semibold text-primary-dark">{cert.courseTitle}</p>
        <div className="mt-10 grid gap-4 text-sm sm:grid-cols-3">
          <div><div className="text-muted">{t("cert.issued")}</div><div className="font-medium">{cert.issuedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</div></div>
          <div><div className="text-muted">{t("cert.issuer")}</div><div className="font-medium">{issuerName}</div></div>
          <div><div className="text-muted">{t("cert.id")}</div><div className="font-mono font-medium">{cert.publicId}</div></div>
        </div>
        <p className="mt-8 break-all text-xs text-muted">{t("cert.verify")}: {url}</p>
      </div>
    </div>
  );
}
