import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/i18n";
import { AdminTitle, Table, Td, hrefWith } from "@/components/admin";
import { Badge, Pagination } from "@/components/ui";
import { ConfirmAction } from "@/components/ConfirmAction";
import { setUserRoleAction, setUserStatusAction } from "@/app/actions/admin";
import { ROLES } from "@/lib/permissions";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
const SIZE = 20;

export default async function Users({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requirePermission("users.read");
  const sp = await searchParams;
  const { t } = await getT();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const where: Prisma.UserWhereInput = { deletedAt: null };
  if (sp.q) where.OR = [{ email: { contains: sp.q, mode: "insensitive" } }, { firstName: { contains: sp.q, mode: "insensitive" } }, { lastName: { contains: sp.q, mode: "insensitive" } }];
  if (sp.role && ROLES[sp.role]) where.roles = { some: { role: { key: sp.role } } };
  if (sp.status && ["PENDING", "ACTIVE", "SUSPENDED", "DISABLED"].includes(sp.status)) where.status = sp.status as "ACTIVE";
  const order = sp.sort === "email" ? { email: "asc" as const } : { createdAt: "desc" as const };
  const [total, users] = await Promise.all([db.user.count({ where }), db.user.findMany({ where, orderBy: order, skip: (page - 1) * SIZE, take: SIZE, include: { roles: { include: { role: true } } } })]);
  const canWrite = me.permissions.has("users.write");
  const canRoles = me.permissions.has("roles.write");
  const tone = { ACTIVE: "success", PENDING: "warning", SUSPENDED: "error", DISABLED: "error" } as const;
  return (
    <>
      <AdminTitle title={t("admin.users")} actions={<a className="btn-secondary" href="/api/admin/export/users?range=90d">{t("common.export")}</a>} />
      <form method="get" role="search" className="mb-4 flex flex-wrap gap-3">
        <input name="q" defaultValue={sp.q} placeholder={t("common.search")} aria-label={t("common.search")} className="input max-w-xs" />
        <select name="role" defaultValue={sp.role ?? ""} aria-label="Role" className="input max-w-[11rem]"><option value="">{t("common.all")}</option>{Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.name}</option>)}</select>
        <select name="status" defaultValue={sp.status ?? ""} aria-label="Status" className="input max-w-[11rem]"><option value="">{t("common.all")}</option>{["PENDING", "ACTIVE", "SUSPENDED", "DISABLED"].map((s) => <option key={s}>{s}</option>)}</select>
        <select name="sort" defaultValue={sp.sort ?? ""} aria-label="Sort" className="input max-w-[11rem]"><option value="">Newest</option><option value="email">Email</option></select>
        <button className="btn-primary" type="submit">{t("common.search")}</button>
      </form>
      <Table caption={t("admin.users")} head={["Name", "Email", "Roles", t("common.status"), "Joined", t("common.actions")]}>
        {users.map((u) => (
          <tr key={u.id}>
            <Td>{u.firstName} {u.lastName}</Td><Td className="text-muted">{u.email}</Td>
            <Td><div className="flex flex-wrap gap-1">{u.roles.map((r) => <Badge key={r.roleId} tone="primary">{r.role.key}</Badge>)}</div></Td>
            <Td><Badge tone={tone[u.status]}>{u.status}</Badge></Td>
            <Td className="text-muted">{u.createdAt.toLocaleDateString()}</Td>
            <Td>
              <div className="flex flex-wrap gap-2">
                {canWrite && u.id !== me.id && (u.status === "ACTIVE"
                  ? <ConfirmAction action={setUserStatusAction} fields={{ id: u.id, status: "SUSPENDED" }} label="Suspend" message={`Suspend ${u.email}? They will be signed out.`} danger />
                  : <ConfirmAction action={setUserStatusAction} fields={{ id: u.id, status: "ACTIVE" }} label="Activate" message={`Activate ${u.email}?`} />)}
                {canRoles && ["INSTRUCTOR", "CONTENT_MANAGER", "SUPPORT", "ADMIN"].map((k) => {
                  const has = u.roles.some((r) => r.role.key === k);
                  return <ConfirmAction key={k} action={setUserRoleAction} fields={{ userId: u.id, role: k, op: has ? "remove" : "add" }} label={`${has ? "− " : "+ "}${k}`} message={`${has ? "Remove" : "Grant"} ${k} ${has ? "from" : "to"} ${u.email}?`} />;
                })}
              </div>
            </Td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} pages={Math.max(1, Math.ceil(total / SIZE))} hrefFor={(p) => hrefWith("/admin/users", sp, { page: String(p) })} label="Users pagination" />
    </>
  );
}
