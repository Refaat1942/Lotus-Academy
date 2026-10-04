"use client";
import { useActionState } from "react";

export type FormState = { error?: string; ok?: string } | null;

/** Generic form bound to a server action; surfaces returned error/ok messages accessibly. */
export function ActionForm({
  action,
  children,
  submitLabel,
  className = "space-y-4",
  buttonClass = "btn-primary w-full",
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  children: React.ReactNode;
  submitLabel: string;
  className?: string;
  buttonClass?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {state?.error && (
        <p role="alert" className="rounded border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">{state.error}</p>
      )}
      {state?.ok && (
        <p role="status" className="rounded border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{state.ok}</p>
      )}
      {children}
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "…" : submitLabel}
      </button>
    </form>
  );
}
