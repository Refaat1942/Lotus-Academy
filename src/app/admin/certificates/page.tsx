import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/i18n";
import { AdminTitle, Table, Td, hrefWith } from "@/components/admin";
import { Badge, Pagination } from "@/components/ui";
import { ConfirmAction } from "@/components/ConfirmAction";
import { revokeCertificateAction } from "@/app/actions/admin";

export const dynamic = "force-dynamic";
const SIZE = 25;

export default async function Certificates({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requirePermission("certificates.read");
  const sp = await searchParams;
  const { t } = await getT();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const where = sp.q ? { OR: [{ publicId: { contains: sp.q.toUpperCase() } }, { recipientName: { contains: sp.q, mode: "insensitive" as const } }] } : {};
  const [total, rows] = await Promise.all([db.certificate.count({ where }), db.certificate.findMany({ where, orderBy: { issuedAt: "desc" }, skip: (page - 1) * SIZE, take: SIZE })]);
  return (
    <>
      <AdminTitle title={t("admin.certificates")} actions={<a className="btn-secondary" href="/api/admin/export/certificates?range=90d">{t("common.export")}</a>} />
      <form method="get" role="search" className="mb-4 flex gap-3"><input name="q" defaultValue={sp.q} placeholder="ID or name" aria-label={t("common.search")} className="input max-w-xs" /><button className="btn-primary" type="submit">{t("common.search")}</button></form>
      <Table caption={t("admin.certificates")} head={["Certificate ID", "Recipient", "Course", "Issued", "Verified", t("common.status"), t("common.actions")]}>
        {rows.map((c) => (
          <tr key={c.id}><Td className="font-mono text-xs"><Link className="text-primary" href={`/verify/certificate/${c.publicId}`}>{c.publicId}</Link></Td><Td>{c.recipientName}</Td><Td>{c.courseTitle}</Td><Td className="text-muted">{c.issuedAt.toLocaleDateString()}</Td><Td>{c.verifiedCount}</Td>
            <Td><Badge tone={c.revokedAt ? "error" : "success"}>{c.revokedAt ? "REVOKED" : "VALID"}</Badge></Td>
            <Td>{me.permissions.has("certificates.write") && <ConfirmAction action={revokeCertificateAction} fields={{ id: c.id, restore: c.revokedAt ? "1" : "0" }} label={c.revokedAt ? "Restore" : "Revoke"} message={c.revokedAt ? "Restore this certificate?" : "Revoke this certificate? Verification will report it as revoked."} danger={!c.revokedAt} />}</Td></tr>
        ))}
      </Table>
      <Pagination page={page} pages={Math.max(1, Math.ceil(total / SIZE))} hrefFor={(p) => hrefWith("/admin/certificates", sp, { page: String(p) })} label="Certificates pagination" />
    </>
  );
}
