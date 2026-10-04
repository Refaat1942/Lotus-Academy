import { cookies } from "next/headers";
import { en, type MessageKey } from "./en";
import { ar } from "./ar";

export type { MessageKey };
export type Locale = "en" | "ar";
export const LOCALE_COOKIE = "la_locale";
const dictionaries: Record<Locale, Record<MessageKey, string>> = { en, ar };

export async function getLocale(): Promise<Locale> {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return v === "ar" ? "ar" : "en";
}

export function makeT(locale: Locale) {
  const d = dictionaries[locale];
  return (key: MessageKey) => d[key] ?? en[key];
}

export async function getT() {
  const locale = await getLocale();
  return { locale, dir: locale === "ar" ? ("rtl" as const) : ("ltr" as const), t: makeT(locale) };
}

/** Picks the localized variant of a bilingual DB field, falling back to English. */
export const pick = (locale: Locale, en_: string | null | undefined, ar_: string | null | undefined) =>
  (locale === "ar" ? ar_ || en_ : en_) ?? "";
