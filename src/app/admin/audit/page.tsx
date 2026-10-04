import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/i18n";
import { AdminTitle, Table, Td, hrefWith } from "@/components/admin";
import { Pagination } from "@/components/ui";

export const dynamic = "force-dynamic";
const SIZE = 40;

export default async function Audit({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermission("audit.read");
  const sp = await searchParams;
  const { t } = await getT();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const where = sp.q ? { action: { contains: sp.q } } : {};
  const [total, rows] = await Promise.all([db.auditLog.count({ where }), db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * SIZE, take: SIZE, include: { actor: true } })]);
  return (
    <>
      <AdminTitle title={t("admin.audit")} actions={<a className="btn-secondary" href="/api/admin/export/audit?range=90d">{t("common.export")}</a>} />
      <form method="get" role="search" className="mb-4 flex gap-3"><input name="q" defaultValue={sp.q} placeholder="Action, e.g. course." aria-label={t("common.search")} className="input max-w-xs" /><button className="btn-primary" type="submit">{t("common.search")}</button></form>
      <Table caption={t("admin.audit")} head={["When", "Actor", "Action", "Entity", "Details"]}>
        {rows.map((l) => <tr key={l.id}><Td className="whitespace-nowrap text-muted">{l.createdAt.toLocaleString()}</Td><Td>{l.actor?.email ?? "system"}</Td><Td className="font-mono text-xs">{l.action}</Td><Td className="text-muted">{l.entity} {l.entityId?.slice(0, 10)}</Td><Td className="max-w-xs truncate font-mono text-xs text-muted">{l.metadata ? JSON.stringify(l.metadata) : ""}</Td></tr>)}
      </Table>
      <Pagination page={page} pages={Math.max(1, Math.ceil(total / SIZE))} hrefFor={(p) => hrefWith("/admin/audit", sp, { page: String(p) })} label="Audit pagination" />
    </>
  );
}
