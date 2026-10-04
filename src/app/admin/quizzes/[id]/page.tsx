import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminTitle } from "@/components/admin";
import { ActionForm } from "@/components/ui/ActionForm";
import { ConfirmAction } from "@/components/ConfirmAction";
import { addQuestionAction, deleteQuestionAction, saveQuestionAction, updateQuizAction } from "@/app/actions/admin";

export const dynamic = "force-dynamic";

export default async function EditQuiz({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePermission("courses.read");
  const { id } = await params;
  const q = await db.quiz.findUnique({ where: { id }, include: { course: true, questions: { orderBy: { position: "asc" }, include: { options: { orderBy: { position: "asc" } } } } } });
  if (!q) notFound();
  const can = me.permissions.has("quizzes.write");
  return (
    <>
      <AdminTitle title={q.titleEn} actions={<Link className="btn-secondary" href={`/admin/courses/${q.courseId}`}>← {q.course.titleEn}</Link>} />
      <section className="card mb-8 p-5">
        {can ? (
          <ActionForm action={updateQuizAction} submitLabel="Save quiz settings" buttonClass="btn-primary" className="grid gap-4 sm:grid-cols-4">
            <input type="hidden" name="id" value={q.id} />
            <div><label className="label" htmlFor="passMark">Pass mark (%)</label><input id="passMark" name="passMark" type="number" min={0} max={100} defaultValue={q.passMark} className="input" /></div>
            <div><label className="label" htmlFor="maxAttempts">Max attempts (0 = unlimited)</label><input id="maxAttempts" name="maxAttempts" type="number" min={0} defaultValue={q.maxAttempts} className="input" /></div>
            <div><label className="label" htmlFor="status">Status</label><select id="status" name="status" defaultValue={q.status} className="input"><option>DRAFT</option><option>PUBLISHED</option><option>ARCHIVED</option></select></div>
            <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" name="required" defaultChecked={q.required} /> Required for completion</label>
          </ActionForm>
        ) : <p className="text-sm text-muted">Read-only.</p>}
      </section>
      <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">Questions ({q.questions.length})</h2>
        {can && <form action={addQuestionAction}><input type="hidden" name="quizId" value={q.id} /><button className="btn-secondary" type="submit">Add question</button></form>}</div>
      <div className="space-y-4">
        {q.questions.map((x, i) => {
          const incomplete = x.options.length < 2 || !x.options.some((o) => o.isCorrect);
          return (
            <section key={x.id} className={`card p-5 ${incomplete ? "border-warning/50" : ""}`}>
              <h3 className="mb-3 text-sm font-semibold">Question {i + 1} {incomplete && <span className="text-warning">— needs 2+ options and a correct answer</span>}</h3>
              {can ? (
                <ActionForm action={saveQuestionAction} submitLabel="Save question" buttonClass="btn-secondary">
                  <input type="hidden" name="id" value={x.id} />
                  <div><label className="label" htmlFor={`p${x.id}`}>Question</label><textarea id={`p${x.id}`} name="promptEn" rows={2} defaultValue={x.promptEn} className="input" /></div>
                  <div><label className="label" htmlFor={`o${x.id}`}>Options (one per line)</label><textarea id={`o${x.id}`} name="options" rows={4} defaultValue={x.options.map((o) => o.textEn).join("\n")} className="input" /></div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div><label className="label" htmlFor={`c${x.id}`}>Correct option number(s), comma separated</label><input id={`c${x.id}`} name="correct" defaultValue={x.options.map((o, idx) => (o.isCorrect ? idx + 1 : 0)).filter(Boolean).join(",")} className="input" /></div>
                    <div><label className="label" htmlFor={`e${x.id}`}>Explanation (shown after submit)</label><input id={`e${x.id}`} name="explanation" defaultValue={x.explanation ?? ""} className="input" /></div>
                  </div>
                </ActionForm>
              ) : <p className="text-sm">{x.promptEn}</p>}
              {can && <div className="mt-3"><ConfirmAction action={deleteQuestionAction} fields={{ id: x.id }} label="Delete question" message="Delete this question?" danger /></div>}
            </section>
          );
        })}
      </div>
    </>
  );
}
