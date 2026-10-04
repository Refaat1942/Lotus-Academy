import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getT } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { getBrand } from "@/lib/brand";
import { PrintButton } from "@/components/PrintButton";
import { CertificateView } from "@/components/CertificateView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Certificate", robots: { index: false } };

export default async function CertificatePage({ params }: { params: Promise<{ certId: string }> }) {
  const { certId } = await params;
  const { t } = await getT();
  const user = await requireUser();
  const cert = await db.certificate.findFirst({
    where: { publicId: certId, userId: user.id }, // owner-only
    include: { course: { include: { category: true, lessons: { where: { status: "PUBLISHED", deletedAt: null }, orderBy: { position: "asc" }, select: { titleEn: true } } } } },
  });
  if (!cert) notFound();
  const [issuer, brand] = await Promise.all([db.systemSetting.findUnique({ where: { key: "certificate.issuer" } }), getBrand()]);
  const c = cert.course;
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 print:p-0">
      <style>{`@media print { @page { size: A4 landscape; margin: 0 } body { background: white } .cert-sheet { width: 297mm; height: 210mm; aspect-ratio: auto } }`}</style>
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-muted">{t("cert.certify")} <strong className="text-text">{cert.recipientName}</strong></p>
        <PrintButton label={t("cert.print")} />
      </div>
      <CertificateView c={{
        publicId: cert.publicId, recipientName: cert.recipientName, courseTitle: cert.courseTitle, courseTitleAr: c.titleAr, courseCode: c.code,
        categorySlug: c.category?.slug, categoryName: c.category?.nameEn, issuedAt: cert.issuedAt, durationMinutes: c.durationMinutes, lessonCount: c.lessons.length,
        topics: c.lessons.slice(0, 8).map((l) => l.titleEn.replace(/\s[—-]\s.*$/, "")), issuerName: (issuer?.value as { en?: string } | null)?.en ?? "Lotus Academy",
        verifyUrl: `${env.appUrl()}/verify/certificate/${cert.publicId}`, logoSrc: brand.logo ? `/api/brand/logo?v=${brand.logo}` : null,
      }} />
    </div>
  );
}
