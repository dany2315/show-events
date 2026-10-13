import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE, type AppLocale } from "@/lib/constants";
import { dictionaries, type Dictionary } from "./dictionaries";

export function isLocale(value: unknown): value is AppLocale {
  return value === "fr" || value === "he";
}

export const getLocale = cache(async (): Promise<AppLocale> => {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
});

export function getDictionary(locale: AppLocale): Dictionary {
  return dictionaries[locale];
}

export async function getI18n() {
  const locale = await getLocale();
  return { locale, t: dictionaries[locale], dir: locale === "he" ? ("rtl" as const) : ("ltr" as const) };
}
