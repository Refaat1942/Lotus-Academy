import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/i18n";
import { AdminTitle, Table, Td } from "@/components/admin";
import { Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Quizzes() {
  await requirePermission("courses.read");
  const { t } = await getT();
  const quizzes = await db.quiz.findMany({ orderBy: [{ course: { sortOrder: "asc" } }, { createdAt: "asc" }], include: { course: true, questions: { include: { options: true } }, _count: { select: { attempts: true } } } });
  return (
    <>
      <AdminTitle title={t("admin.quizzes")} actions={<a className="btn-secondary" href="/api/admin/export/quizzes?range=90d">{t("common.export")}</a>} />
      <Table caption={t("admin.quizzes")} head={["Quiz", "Course", "Questions", "Incomplete", "Attempts", t("common.status")]}>
        {quizzes.map((q) => {
          const incomplete = q.questions.filter((x) => x.options.length < 2 || !x.options.some((o) => o.isCorrect)).length;
          return (
            <tr key={q.id}><Td><Link className="font-medium text-primary" href={`/admin/quizzes/${q.id}`}>{q.titleEn}</Link></Td><Td className="text-muted">{q.course.code}</Td><Td>{q.questions.length}</Td>
              <Td>{incomplete ? <Badge tone="warning">{incomplete}</Badge> : "—"}</Td><Td>{q._count.attempts}</Td><Td><Badge tone={q.status === "PUBLISHED" ? "success" : "warning"}>{q.status}</Badge></Td></tr>
          );
        })}
      </Table>
    </>
  );
}
