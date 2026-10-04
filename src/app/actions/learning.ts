"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { assertUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { completeLesson, enroll, submitCheckpoint, submitQuiz, toggleBookmark } from "@/lib/learning";

export async function enrollAction(fd: FormData) {
  const user = await assertUser();
  const courseId = String(fd.get("courseId") ?? "");
  await enroll(user.id, courseId);
  const course = await db.course.findUniqueOrThrow({ where: { id: courseId }, select: { slug: true, lessons: { where: { status: "PUBLISHED", deletedAt: null }, orderBy: { position: "asc" }, take: 1, select: { slug: true } } } });
  redirect(course.lessons[0] ? `/learn/${course.slug}/${course.lessons[0].slug}` : `/courses/${course.slug}`);
}

export async function completeLessonAction(fd: FormData) {
  const user = await assertUser();
  const lessonId = String(fd.get("lessonId") ?? "");
  await completeLesson(user.id, lessonId);
  revalidatePath("/learn", "layout");
  revalidatePath("/dashboard");
}

export async function bookmarkAction(fd: FormData) {
  const user = await assertUser();
  await toggleBookmark(user.id, String(fd.get("lessonId") ?? ""));
  revalidatePath("/learn", "layout");
}

export async function submitQuizAction(fd: FormData) {
  const user = await assertUser();
  const quizId = String(fd.get("quizId") ?? "");
  const answers: Record<string, string[]> = {};
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("q_")) (answers[k.slice(2)] ??= []).push(String(v));
  }
  const res = await submitQuiz(user.id, quizId, answers);
  revalidatePath("/learn", "layout");
  redirect(`/quiz-result/${res.attemptId}`);
}

export async function submitCheckpointAction(fd: FormData) {
  const user = await assertUser();
  const lessonId = String(fd.get("lessonId") ?? "");
  const back = String(fd.get("back") ?? "/dashboard");
  const answers: Record<string, string[]> = {};
  for (const [k, v] of fd.entries()) if (k.startsWith("q_")) (answers[k.slice(2)] ??= []).push(String(v));
  const res = await submitCheckpoint(user.id, lessonId, answers);
  revalidatePath("/learn", "layout");
  revalidatePath("/dashboard");
  redirect(`${/^\/learn\/[\w-]+\/[\w-]+$/.test(back) ? back : "/dashboard"}?cp=${res.passed ? "pass" : "fail"}#checkpoint`);
}
