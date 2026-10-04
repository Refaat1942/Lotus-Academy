import { Logo } from "./Logo";

export function AuthShell({ title, lead, children, footer }: { title: string; lead?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-12 sm:py-16">
      <div className="mb-8 flex justify-center"><Logo /></div>
      <div className="card p-7">
        <h1 className="text-2xl font-semibold tracking-tight text-primary-dark">{title}</h1>
        {lead && <p className="mt-1 text-sm text-muted">{lead}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <p className="mt-6 text-center text-sm text-muted">{footer}</p>}
    </div>
  );
}
