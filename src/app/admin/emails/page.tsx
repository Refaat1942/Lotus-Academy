import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/i18n";
import { AdminTitle, Table, Td, hrefWith } from "@/components/admin";
import { Badge, Pagination } from "@/components/ui";

export const dynamic = "force-dynamic";
const SIZE = 30;

export default async function Emails({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermission("emails.read");
  const sp = await searchParams;
  const { t } = await getT();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const where = sp.status && ["SENT", "FAILED", "QUEUED"].includes(sp.status) ? { status: sp.status as "SENT" } : {};
  const [total, rows] = await Promise.all([db.emailLog.count({ where }), db.emailLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * SIZE, take: SIZE })]);
  return (
    <>
      <AdminTitle title={t("admin.emails")} actions={<a className="btn-secondary" href="/api/admin/export/emails?range=90d">{t("common.export")}</a>} />
      <form method="get" className="mb-4 flex gap-3"><select name="status" defaultValue={sp.status ?? ""} aria-label="Status" className="input max-w-[11rem]"><option value="">{t("common.all")}</option><option>SENT</option><option>FAILED</option><option>QUEUED</option></select><button className="btn-primary" type="submit">{t("common.search")}</button></form>
      <Table caption={t("admin.emails")} head={["When", "Recipient", "Template", "Provider", t("common.status"), "Retries", "Error"]}>
        {rows.map((e) => <tr key={e.id}><Td className="text-muted">{e.createdAt.toLocaleString()}</Td><Td>{e.recipient}</Td><Td>{e.template}</Td><Td>{e.provider}</Td><Td><Badge tone={e.status === "SENT" ? "success" : e.status === "FAILED" ? "error" : "warning"}>{e.status}</Badge></Td><Td>{e.retryCount}</Td><Td className="max-w-xs truncate text-xs text-muted" >{e.error}</Td></tr>)}
      </Table>
      <Pagination page={page} pages={Math.max(1, Math.ceil(total / SIZE))} hrefFor={(p) => hrefWith("/admin/emails", sp, { page: String(p) })} label="Emails pagination" />
    </>
  );
}
