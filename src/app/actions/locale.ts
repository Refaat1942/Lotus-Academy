"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE, getLocale } from "@/i18n";

export async function toggleLocaleAction() {
  const next = (await getLocale()) === "ar" ? "en" : "ar";
  (await cookies()).set(LOCALE_COOKIE, next, { path: "/", maxAge: 365 * 86400, sameSite: "lax" });
  revalidatePath("/", "layout");
}
