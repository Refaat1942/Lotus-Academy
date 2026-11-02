"use client";
import { useActionState } from "react";
import type { ImportState } from "@/app/actions/admin";

export function ImportUsersForm({ action }: { action: (s: ImportState, fd: FormData) => Promise<ImportState> }) {
  const [state, formAction, pending] = useActionState(action, null);
  const download = () => {
    if (!state?.credentials.length) return;
    const csv = "﻿email,temporaryPassword\r\n" + state.credentials.map((c) => `${c.email},${c.password}`).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "lotus-academy-new-accounts.csv";
    a.click();
  };
  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4">
        <div><label className="label" htmlFor="file">CSV file</label><input id="file" name="file" type="file" accept=".csv,text/csv" className="input" /></div>
        <div><label className="label" htmlFor="csv">…or paste CSV</label><textarea id="csv" name="csv" rows={6} className="input font-mono text-xs" placeholder={"email,firstName,lastName,phone,jobRole,branch,area,department\npharm1@lotus.example,First,Last,,PHARMACIST,Nasr City 1,Cairo East,"} /></div>
        <button className="btn-primary" type="submit" disabled={pending}>{pending ? "Importing…" : "Import users"}</button>
      </form>
      {state?.error && <p role="alert" className="rounded border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">{state.error}</p>}
      {state && !state.error && (
        <div role="status" className="space-y-3 rounded-xl border border-success/30 bg-success/5 p-4 text-sm">
          <p><strong>{state.created}</strong> created · <strong>{state.updated}</strong> updated · <strong>{state.assigned}</strong> mandatory assignments · <strong>{state.errors.length}</strong> rows with errors</p>
          {state.credentials.length > 0 && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-3">
              <p className="mb-2 font-medium">Temporary passwords are shown only now. Download them and share each one privately; users must change it at first sign-in.</p>
              <button type="button" className="btn-secondary" onClick={download}>Download new accounts (CSV)</button>
            </div>
          )}
          {state.errors.length > 0 && <ul className="list-disc space-y-1 ps-5 text-error">{state.errors.slice(0, 50).map((e) => <li key={e}>{e}</li>)}</ul>}
        </div>
      )}
    </div>
  );
}
