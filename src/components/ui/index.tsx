import Link from "next/link";

export function Progress({ value, label }: { value: number; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? "Progress"} className="h-2 w-full overflow-hidden rounded-full bg-primary-light">
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${v}%` }} />
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="card p-5">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1 text-3xl font-semibold tracking-tight text-primary-dark">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

const tones = {
  neutral: "bg-background text-muted border border-border",
  primary: "bg-primary-light text-primary-dark",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  error: "bg-error/10 text-error",
};
export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: keyof typeof tones }) {
  return <span className={`badge ${tones[tone]}`}>{children}</span>;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: { href: string; label: string } }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 h-10 w-10 rounded-full bg-primary-light" aria-hidden />
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-muted">{description}</p>}
      {action && <Link href={action.href} className="btn-primary mt-5">{action.label}</Link>}
    </div>
  );
}

export function PageHeader({ title, lead, eyebrow }: { title: string; lead?: string; eyebrow?: string }) {
  return (
    <div className="border-b border-border bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        {eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-secondary">{eyebrow}</p>}
        <h1 className="text-3xl font-semibold tracking-tight text-primary-dark sm:text-4xl">{title}</h1>
        {lead && <p className="mt-3 max-w-2xl text-lg text-muted">{lead}</p>}
      </div>
    </div>
  );
}

export function Pagination({ page, pages, hrefFor, label }: { page: number; pages: number; hrefFor: (p: number) => string; label: string }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label={label} className="mt-6 flex items-center justify-between text-sm">
      <span className="text-muted">{page} / {pages}</span>
      <div className="flex gap-2">
        {page > 1 && <Link className="btn-secondary" href={hrefFor(page - 1)} rel="prev">‹</Link>}
        {page < pages && <Link className="btn-secondary" href={hrefFor(page + 1)} rel="next">›</Link>}
      </div>
    </nav>
  );
}

export function fmtDuration(min: number, t: (k: "common.hours" | "common.minutes") => string) {
  if (min >= 60) {
    const h = Math.floor(min / 60), m = min % 60;
    return `${h}${t("common.hours")}${m ? ` ${m}${t("common.minutes")}` : ""}`;
  }
  return `${min}${t("common.minutes")}`;
}
