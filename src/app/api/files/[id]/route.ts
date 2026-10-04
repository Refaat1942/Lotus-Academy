import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { safeFileName } from "@/lib/materials";

export const dynamic = "force-dynamic";

/** Course materials: only enrolled learners (published lessons) and staff may download. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const asset = await db.lessonAsset.findFirst({ where: { fileId: id }, include: { lesson: true } });
  if (!asset) return new Response("Not found", { status: 404 });
  if (!user.permissions.has("courses.read")) {
    const enr = await db.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: asset.lesson.courseId } } });
    if (!enr || enr.status === "CANCELLED" || asset.lesson.status !== "PUBLISHED" || asset.lesson.deletedAt) return new Response("Forbidden", { status: 403 });
  }
  const f = await db.storedFile.findUnique({ where: { id } });
  if (!f) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(f.data), {
    headers: {
      "Content-Type": f.mime,
      "Content-Disposition": `attachment; filename="${safeFileName(f.name)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
