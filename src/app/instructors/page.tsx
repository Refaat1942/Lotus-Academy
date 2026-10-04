import { db } from "@/lib/db";
import { getT, pick } from "@/i18n";
import { EmptyState, PageHeader } from "@/components/ui";
export const metadata = { title: "Instructors" };
export const dynamic = "force-dynamic";
export default async function Instructors() {
  const { t, locale } = await getT();
  const list = await db.instructorProfile.findMany({ where: { isPublic: true, user: { status: "ACTIVE", deletedAt: null } }, include: { user: true } });
  return (<><PageHeader title={t("instructors.title")} lead={t("instructors.lead")} /><div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
    {list.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{list.map((i) => <div key={i.userId} className="card p-6"><h2 className="font-semibold">{i.user.firstName} {i.user.lastName}</h2><p className="text-sm text-muted">{pick(locale, i.titleEn, i.titleAr)}</p><p className="mt-3 text-sm">{pick(locale, i.bioEn, i.bioAr)}</p></div>)}</div> : <EmptyState title={t("instructors.empty")} />}
  </div></>);
}
