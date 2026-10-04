import Link from "next/link";

export function AdminTitle({ title, actions }: { title: string; actions?: React.ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold tracking-tight text-primary-dark">{title}</h1><div className="flex gap-2">{actions}</div></div>;
}

export function Table({ head, children, caption }: { head: string[]; children: React.ReactNode; caption: string }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-border bg-background text-start text-xs uppercase tracking-wider text-muted"><tr>{head.map((h) => <th key={h} scope="col" className="px-4 py-3 text-start font-semibold">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}
export const Td = ({ children, className = "" }: { children?: React.ReactNode; className?: string }) => <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;

/** Link-based pager that preserves existing query params. */
export function hrefWith(base: string, sp: Record<string, string | undefined>, over: Record<string, string>) {
  const u = new URLSearchParams(Object.entries({ ...sp, ...over }).filter(([, v]) => v) as [string, string][]);
  return `${base}?${u}`;
}

export { Link };
