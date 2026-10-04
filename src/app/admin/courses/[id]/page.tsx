import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminTitle } from "@/components/admin";
import { Badge } from "@/components/ui";
import { ActionForm } from "@/components/ui/ActionForm";
import { ConfirmAction } from "@/components/ConfirmAction";
import { addModuleAction, archiveLessonAction, assignInstructorAction, createLessonAction, deleteModuleAction, moveLessonAction, moveModuleAction, removeCourseCoverAction, removeInstructorAction, setLessonModuleAction, updateCourseAction, updateModuleAction, uploadCourseCoverAction } from "@/app/actions/admin";

export const dynamic = "force-dynamic";

export default async function EditCourse({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePermission("courses.read");
  const { id } = await params;
  const [c, cats] = await Promise.all([
    db.course.findFirst({ where: { id, deletedAt: null }, include: { instructors: { include: { instructor: { include: { user: true } } } }, lessons: { where: { deletedAt: null }, orderBy: { position: "asc" }, include: { quizzes: { select: { id: true, status: true } }, _count: { select: { videos: true, assets: true } } } }, modules: { orderBy: { position: "asc" } } } }),
    db.courseCategory.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  if (!c) notFound();
  const canWrite = me.permissions.has("courses.write");
  const canLessons = me.permissions.has("lessons.write");
  return (
    <>
      <AdminTitle title={c.titleEn} actions={<><Badge tone={c.status === "PUBLISHED" ? "success" : "warning"}>{c.status}</Badge><Link className="btn-secondary" href={`/courses/${c.slug}`}>View public page</Link></>} />
      <div className="grid gap-8 xl:grid-cols-3">
        <section className="card p-5 xl:col-span-2"><h2 className="mb-4 font-semibold">Course details</h2>
          {canWrite ? (
            <ActionForm action={updateCourseAction} submitLabel="Save course" buttonClass="btn-primary" className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="id" value={c.id} />
              <div><label className="label" htmlFor="titleEn">Title (EN)</label><input id="titleEn" name="titleEn" defaultValue={c.titleEn} required className="input" /></div>
              <div><label className="label" htmlFor="titleAr">Title (AR)</label><input id="titleAr" name="titleAr" dir="rtl" defaultValue={c.titleAr ?? ""} className="input" /></div>
              <div className="sm:col-span-2"><label className="label" htmlFor="summaryEn">Summary (EN)</label><textarea id="summaryEn" name="summaryEn" rows={2} defaultValue={c.summaryEn ?? ""} className="input" /></div>
              <div className="sm:col-span-2"><label className="label" htmlFor="summaryAr">Summary (AR)</label><textarea id="summaryAr" name="summaryAr" dir="rtl" rows={2} defaultValue={c.summaryAr ?? ""} className="input" /></div>
              <div className="sm:col-span-2"><label className="label" htmlFor="descriptionEn">Description (EN)</label><textarea id="descriptionEn" name="descriptionEn" rows={4} defaultValue={c.descriptionEn ?? ""} className="input" /></div>
              <div className="sm:col-span-2"><label className="label" htmlFor="descriptionAr">Description (AR)</label><textarea id="descriptionAr" name="descriptionAr" dir="rtl" rows={4} defaultValue={c.descriptionAr ?? ""} className="input" /></div>
              <div><label className="label" htmlFor="objectivesEn">Learning objectives (EN, one per line)</label><textarea id="objectivesEn" name="objectivesEn" rows={5} defaultValue={c.objectivesEn.join("\n")} className="input" /></div>
              <div><label className="label" htmlFor="objectivesAr">Learning objectives (AR)</label><textarea id="objectivesAr" name="objectivesAr" dir="rtl" rows={5} defaultValue={c.objectivesAr.join("\n")} className="input" /></div>
              <div className="sm:col-span-2"><label className="label" htmlFor="prerequisitesEn">Prerequisites</label><input id="prerequisitesEn" name="prerequisitesEn" defaultValue={c.prerequisitesEn ?? ""} className="input" /></div>
              <div><label className="label" htmlFor="categoryId">Category</label><select id="categoryId" name="categoryId" defaultValue={c.categoryId ?? ""} className="input"><option value="">—</option>{cats.map((k) => <option key={k.id} value={k.id}>{k.nameEn}</option>)}</select></div>
              <div><label className="label" htmlFor="level">Level</label><select id="level" name="level" defaultValue={c.level} className="input"><option>BEGINNER</option><option>INTERMEDIATE</option><option>ADVANCED</option></select></div>
              <div><label className="label" htmlFor="durationMinutes">Duration (minutes)</label><input id="durationMinutes" name="durationMinutes" type="number" min={0} defaultValue={c.durationMinutes} className="input" /></div>
              <div><label className="label" htmlFor="passMark">Pass mark (%)</label><input id="passMark" name="passMark" type="number" min={0} max={100} defaultValue={c.passMark} className="input" /></div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="sequential" defaultChecked={c.sequential} /> Learners must finish each lesson (and answer its checkpoint) before the next one unlocks</label>
              <input type="hidden" name="thumbnailUrl" value={c.thumbnailUrl ?? ""} />
            </ActionForm>
          ) : <p className="text-sm text-muted">You have read-only access.</p>}
        </section>

        <div className="space-y-8">
          <section className="card p-5"><h2 className="mb-3 font-semibold">Cover image</h2>
            {c.thumbnailUrl ? (<div className="mb-3 space-y-2">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={c.thumbnailUrl} alt="Course cover" className="h-28 w-full rounded-xl border border-border object-cover" />{canWrite && <form action={removeCourseCoverAction}><input type="hidden" name="courseId" value={c.id} /><button className="btn-secondary !text-error" type="submit">Remove cover</button></form>}</div>) : <p className="mb-3 text-sm text-muted">No cover: the course shows its category color and icon.</p>}
            {canWrite && <ActionForm action={uploadCourseCoverAction} submitLabel="Upload cover" buttonClass="btn-secondary"><input type="hidden" name="courseId" value={c.id} /><input name="file" type="file" required accept="image/*" aria-label="Cover image file" className="input" /></ActionForm>}
          </section>
          <section className="card p-5"><h2 className="mb-3 font-semibold">Instructors</h2>
            <ul className="mb-4 space-y-2 text-sm">{c.instructors.map((i) => <li key={i.instructorId} className="flex items-center justify-between"><span>{i.instructor.user.firstName} {i.instructor.user.lastName}</span>{canWrite && <ConfirmAction action={removeInstructorAction} fields={{ courseId: c.id, instructorId: i.instructorId }} label="Remove" message="Remove this instructor from the course?" danger />}</li>)}{!c.instructors.length && <li className="text-muted">None assigned</li>}</ul>
            {canWrite && <ActionForm action={assignInstructorAction} submitLabel="Assign" buttonClass="btn-secondary"><input type="hidden" name="courseId" value={c.id} /><label className="label" htmlFor="email">Instructor email</label><input id="email" name="email" type="email" required className="input" /></ActionForm>}
          </section>
          <section className="card p-5 text-xs text-muted"><h2 className="mb-2 text-sm font-semibold text-text">Source</h2>{c.sourceArchive ? <><p>Archive: {c.sourceArchive}</p><p>Imported: {c.importedAt?.toLocaleString()}</p><p className="break-all">Hash: {c.sourceHash}</p></> : <p>Created in admin.</p>}</section>
        </div>
      </div>

      <section className="mt-10">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Learning pathway</h2>
          {canLessons && <form action={addModuleAction}><input type="hidden" name="courseId" value={c.id} /><button className="btn-secondary" type="submit">+ Add module</button></form>}
        </div>
        <p className="mb-5 text-sm text-muted">Design the route learners follow: modules are the stages, lessons run in order inside each stage. Every lesson can hold text, videos and downloadable materials.</p>
        <ol className="space-y-6">
          {c.modules.map((m, mi) => {
            const ls = c.lessons.filter((l) => l.moduleId === m.id);
            return (
              <li key={m.id} className="card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-primary-light/60 px-5 py-3">
                  <h3 className="flex items-center gap-3 font-bold"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm text-white">{mi + 1}</span>{m.titleEn}<span className="text-xs font-normal text-muted">{ls.length} lessons</span></h3>
                  {canLessons && (
                    <div className="flex gap-1">
                      <form action={moveModuleAction}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="dir" value="up" /><button className="btn-secondary !px-2 !py-1" disabled={mi === 0} aria-label={`Move module ${m.titleEn} up`}>↑</button></form>
                      <form action={moveModuleAction}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="dir" value="down" /><button className="btn-secondary !px-2 !py-1" disabled={mi === c.modules.length - 1} aria-label={`Move module ${m.titleEn} down`}>↓</button></form>
                      {!ls.length && c.modules.length > 1 && <ConfirmAction action={deleteModuleAction} fields={{ id: m.id }} label="Delete" message="Delete this empty module?" danger />}
                    </div>
                  )}
                </div>
                {canLessons && (
                  <details className="border-b border-border px-5 py-2 text-sm"><summary className="cursor-pointer font-medium text-primary">Edit module details</summary>
                    <div className="py-3"><ActionForm action={updateModuleAction} submitLabel="Save module" buttonClass="btn-secondary" className="grid gap-3 sm:grid-cols-2">
                      <input type="hidden" name="id" value={m.id} />
                      <div><label className="label" htmlFor={`mt${m.id}`}>Title (EN)</label><input id={`mt${m.id}`} name="titleEn" defaultValue={m.titleEn} required className="input" /></div>
                      <div><label className="label" htmlFor={`ma${m.id}`}>Title (AR)</label><input id={`ma${m.id}`} name="titleAr" dir="rtl" defaultValue={m.titleAr ?? ""} className="input" /></div>
                      <div><label className="label" htmlFor={`md${m.id}`}>Description (EN)</label><textarea id={`md${m.id}`} name="descriptionEn" rows={2} defaultValue={m.descriptionEn ?? ""} className="input" /></div>
                      <div><label className="label" htmlFor={`mr${m.id}`}>Description (AR)</label><textarea id={`mr${m.id}`} name="descriptionAr" dir="rtl" rows={2} defaultValue={m.descriptionAr ?? ""} className="input" /></div>
                    </ActionForm></div></details>
                )}
                <ol className="divide-y divide-border">
                  {ls.map((l, i) => (
                    <li key={l.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                      <span className="w-6 text-muted">{i + 1}</span>
                      <Link className="min-w-0 flex-1 font-medium text-primary" href={`/admin/courses/${c.id}/lessons/${l.id}`}>{l.titleEn}</Link>
                      <span className="text-xs text-muted">{l._count.videos} video · {l._count.assets} material{l._count.assets === 1 ? "" : "s"}</span>
                      <Badge tone={l.status === "PUBLISHED" ? "success" : "warning"}>{l.status}</Badge>
                      {l.quizzes[0] && <Link href={`/admin/quizzes/${l.quizzes[0].id}`} className="text-xs text-primary underline">Quiz ({l.quizzes[0].status})</Link>}
                      {canLessons && (
                        <div className="flex flex-wrap items-center gap-1">
                          <form action={setLessonModuleAction} className="flex items-center gap-1"><input type="hidden" name="id" value={l.id} />
                            <select name="moduleId" defaultValue={l.moduleId} aria-label={`Module for ${l.titleEn}`} className="input !w-auto !py-1 text-xs">{c.modules.map((x) => <option key={x.id} value={x.id}>{x.titleEn}</option>)}</select>
                            <button className="btn-secondary !px-2 !py-1 text-xs" type="submit">Move</button></form>
                          <form action={moveLessonAction}><input type="hidden" name="id" value={l.id} /><input type="hidden" name="dir" value="up" /><button className="btn-secondary !px-2 !py-1" disabled={i === 0} aria-label={`Move ${l.titleEn} up`}>↑</button></form>
                          <form action={moveLessonAction}><input type="hidden" name="id" value={l.id} /><input type="hidden" name="dir" value="down" /><button className="btn-secondary !px-2 !py-1" disabled={i === ls.length - 1} aria-label={`Move ${l.titleEn} down`}>↓</button></form>
                          <ConfirmAction action={archiveLessonAction} fields={{ id: l.id }} label="Archive" message={`Archive “${l.titleEn}”? Learner progress is kept.`} danger />
                        </div>
                      )}
                    </li>
                  ))}
                  {!ls.length && <li className="px-5 py-4 text-sm text-muted">No lessons in this module yet.</li>}
                </ol>
                {canLessons && <form action={createLessonAction} className="border-t border-border bg-background/50 px-5 py-3"><input type="hidden" name="courseId" value={c.id} /><input type="hidden" name="moduleId" value={m.id} /><button className="text-sm font-semibold text-primary hover:underline" type="submit">+ Add lesson to this module</button></form>}
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}
