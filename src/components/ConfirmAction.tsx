"use client";
import { useRef } from "react";

/** Button that opens an accessible modal <dialog> before submitting a server action. */
export function ConfirmAction({ action, fields, label, message, danger = false }: {
  action: (fd: FormData) => Promise<void>;
  fields: Record<string, string>;
  label: string;
  message: string;
  danger?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className={danger ? "btn-secondary !text-error" : "btn-secondary"} onClick={() => ref.current?.showModal()}>{label}</button>
      <dialog ref={ref} className="rounded-lg border border-border p-0 shadow-xl backdrop:bg-black/40" aria-labelledby="confirm-title">
        <form action={action} className="w-[min(92vw,26rem)] space-y-4 p-6">
          {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <h2 id="confirm-title" className="text-lg font-semibold">{label}</h2>
          <p className="text-sm text-muted">{message}</p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => ref.current?.close()}>Cancel</button>
            <button type="submit" className={danger ? "btn-danger" : "btn-primary"}>{label}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
