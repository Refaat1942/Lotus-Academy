import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminTitle } from "@/components/admin";
import { ActionForm } from "@/components/ui/ActionForm";
import { ConfirmAction } from "@/components/ConfirmAction";
import { addMaterialLinkAction, addVideoAction, deleteMaterialAction, deleteVideoAction, updateLessonAction, uploadMaterialAction } from "@/app/actions/admin";
import { renderMarkdown } from "@/lib/markdown";

export const dynamic = "force-dynamic";

export default async function EditLesson({ params }: { params: Promise<{ id: string; lessonId: string }> }) {
  const me = await requirePermission("courses.read");
  const { id, lessonId } = await params;
  const l = await db.lesson.findFirst({ where: { id: lessonId, courseId: id }, include: { videos: true, assets: true, course: true } });
  if (!l) notFound();
  const can = me.permissions.has("lessons.write");
  return (
    <>
      <AdminTitle title={l.titleEn} actions={<Link className="btn-secondary" href={`/admin/courses/${id}`}>← {l.course.titleEn}</Link>} />
      <div className="grid gap-8 xl:grid-cols-2">
        <section className="card p-5">
          {can ? (
            <ActionForm action={updateLessonAction} submitLabel="Save lesson" buttonClass="btn-primary">
              <input type="hidden" name="id" value={l.id} />
              <div><label className="label" htmlFor="titleEn">Title (EN)</label><input id="titleEn" name="titleEn" defaultValue={l.titleEn} required className="input" /></div>
              <div><label className="label" htmlFor="titleAr">Title (AR)</label><input id="titleAr" name="titleAr" dir="rtl" defaultValue={l.titleAr ?? ""} className="input" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label" htmlFor="durationMinutes">Duration (min)</label><input id="durationMinutes" name="durationMinutes" type="number" min={0} defaultValue={l.durationMinutes} className="input" /></div>
                <div><label className="label" htmlFor="status">Status</label><select id="status" name="status" defaultValue={l.status} className="input"><option>DRAFT</option><option>PUBLISHED</option><option>ARCHIVED</option></select></div>
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPreview" defaultChecked={l.isPreview} /> Free preview lesson</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="requireCheckpoint" defaultChecked={l.requireCheckpoint} /> Require a “check your understanding” question before the learner can continue</label>
              <div><label className="label" htmlFor="objectives">Learning objectives (one per line)</label><textarea id="objectives" name="objectives" rows={4} defaultValue={l.objectives.join("\n")} className="input" /></div>
              <div><label className="label" htmlFor="bodyMd">Content (Markdown)</label><textarea id="bodyMd" name="bodyMd" rows={22} defaultValue={l.bodyMd} className="input font-mono text-xs" /></div>
              <div><label className="label" htmlFor="objectivesAr">Learning objectives — Arabic (one per line)</label><textarea id="objectivesAr" name="objectivesAr" dir="rtl" rows={3} defaultValue={l.objectivesAr.join("\n")} className="input" /></div>
              <div><label className="label" htmlFor="bodyMdAr">Content — Arabic (Markdown)</label><textarea id="bodyMdAr" name="bodyMdAr" dir="rtl" rows={18} defaultValue={l.bodyMdAr ?? ""} className="input font-mono text-xs" /></div>
              <details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-sm font-medium">Video production scripts (not shown to learners)</summary>
                <div className="mt-3 space-y-3"><div><label className="label" htmlFor="videoScriptEn">English script</label><textarea id="videoScriptEn" name="videoScriptEn" rows={8} defaultValue={l.videoScriptEn ?? ""} className="input text-xs" /></div>
                <div><label className="label" htmlFor="videoScriptAr">Arabic script</label><textarea id="videoScriptAr" name="videoScriptAr" dir="rtl" rows={8} defaultValue={l.videoScriptAr ?? ""} className="input text-xs" /></div></div></details>
            </ActionForm>
          ) : <p className="text-sm text-muted">Read-only.</p>}
        </section>
        <div className="space-y-8">
          <section className="card p-5"><h2 className="mb-3 font-semibold">Videos</h2>
            <ul className="mb-4 space-y-2 text-sm">{l.videos.map((v) => <li key={v.id} className="flex items-center justify-between gap-2"><span className="truncate">[{v.language.toUpperCase()}] {v.provider} · {v.url}</span>{can && <ConfirmAction action={deleteVideoAction} fields={{ id: v.id }} label="Delete" message="Remove this video?" danger />}</li>)}{!l.videos.length && <li className="text-muted">No videos</li>}</ul>
            {can && <ActionForm action={addVideoAction} submitLabel="Add video" buttonClass="btn-secondary">
              <input type="hidden" name="lessonId" value={l.id} />
              <div><label className="label" htmlFor="language">Video language</label><select id="language" name="language" className="input"><option value="ar">Arabic</option><option value="en">English</option><option value="all">Both / language-neutral</option></select></div>
              <div><label className="label" htmlFor="provider">Provider</label><select id="provider" name="provider" className="input"><option>YOUTUBE</option><option>VIMEO</option><option>PRIVATE</option><option>OBJECT_STORAGE</option><option>CDN</option></select></div>
              <div><label className="label" htmlFor="externalId">External ID (YouTube/Vimeo)</label><input id="externalId" name="externalId" className="input" /></div>
              <div><label className="label" htmlFor="url">URL (https)</label><input id="url" name="url" type="url" required className="input" /></div>
            </ActionForm>}
          </section>
          <section className="card p-5"><h2 className="mb-1 font-semibold">Educational materials</h2>
            <p className="mb-3 text-sm text-muted">Attach PDFs, Word/PowerPoint/Excel files, images (up to 15 MB) or external links. Files are only available to enrolled learners.</p>
            <ul className="mb-4 space-y-2 text-sm">{l.assets.map((a) => <li key={a.id} className="flex items-center justify-between gap-2"><span className="min-w-0 truncate">{a.kind === "FILE" ? "📎" : "🔗"} {a.name}{a.sizeBytes ? ` · ${Math.round(a.sizeBytes / 1024)} KB` : ""}</span>{can && <ConfirmAction action={deleteMaterialAction} fields={{ id: a.id }} label="Delete" message="Remove this material?" danger />}</li>)}{!l.assets.length && <li className="text-muted">No materials yet</li>}</ul>
            {can && (<div className="space-y-5 border-t border-border pt-4">
              <ActionForm action={uploadMaterialAction} submitLabel="Upload file" buttonClass="btn-secondary"><input type="hidden" name="lessonId" value={l.id} />
                <div><label className="label" htmlFor="mfile">File</label><input id="mfile" name="file" type="file" required accept=".pdf,.docx,.pptx,.xlsx,image/*" className="input" /></div>
                <div><label className="label" htmlFor="mname">Title (optional)</label><input id="mname" name="name" maxLength={150} className="input" /></div></ActionForm>
              <ActionForm action={addMaterialLinkAction} submitLabel="Add link" buttonClass="btn-secondary"><input type="hidden" name="lessonId" value={l.id} />
                <div><label className="label" htmlFor="lname">Link title</label><input id="lname" name="name" required maxLength={150} className="input" /></div>
                <div><label className="label" htmlFor="lurl">URL (https)</label><input id="lurl" name="url" type="url" required className="input" /></div></ActionForm>
            </div>)}
          </section>
          <section className="card p-5"><h2 className="mb-3 font-semibold">Preview</h2><div className="prose-lotus max-h-[28rem] overflow-y-auto text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(l.bodyMd) }} /></section>
        </div>
      </div>
    </>
  );
}
