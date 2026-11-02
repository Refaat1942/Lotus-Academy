import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminTitle } from "@/components/admin";
import { ActionForm } from "@/components/ui/ActionForm";
import { ImportUsersForm } from "@/components/ImportUsersForm";
import { createUserAction, importUsersAction } from "@/app/actions/admin";

export const dynamic = "force-dynamic";

export default async function NewUsers() {
  await requirePermission("users.write");
  const audiences = await db.audience.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <>
      <AdminTitle title="Add staff" actions={<Link className="btn-secondary" href="/admin/users">← Users</Link>} />
      <div className="grid gap-8 xl:grid-cols-2">
        <section className="card p-5"><h2 className="mb-1 font-semibold">Import from a spreadsheet (CSV)</h2>
          <p className="mb-4 text-sm text-muted">Columns: <code>email, firstName, lastName</code> (required) and <code>phone, jobRole, branch, area, department</code> (optional). Job role accepts {audiences.map((a) => a.key).join(", ")}. Existing emails are updated, new ones get an active account with a temporary password, and mandatory courses are assigned automatically.</p>
          <ImportUsersForm action={importUsersAction} />
        </section>
        <section className="card p-5"><h2 className="mb-4 font-semibold">Add one user</h2>
          <ActionForm action={createUserAction} submitLabel="Create account" buttonClass="btn-primary">
            <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required className="input" /></div>
            <div className="grid grid-cols-2 gap-3"><div><label className="label" htmlFor="firstName">First name</label><input id="firstName" name="firstName" required className="input" /></div><div><label className="label" htmlFor="lastName">Last name</label><input id="lastName" name="lastName" required className="input" /></div></div>
            <div><label className="label" htmlFor="audienceId">Job role</label><select id="audienceId" name="audienceId" className="input">{audiences.map((a) => <option key={a.id} value={a.id}>{a.nameEn} / {a.nameAr}</option>)}</select></div>
            <div className="grid grid-cols-3 gap-3"><div><label className="label" htmlFor="branch">Branch</label><input id="branch" name="branch" className="input" /></div><div><label className="label" htmlFor="area">Area</label><input id="area" name="area" className="input" /></div><div><label className="label" htmlFor="department">Department</label><input id="department" name="department" className="input" /></div></div>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
