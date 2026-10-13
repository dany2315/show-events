"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, type AppLocale } from "@/lib/constants";

export async function setLocaleAction(locale: AppLocale) {
  if (locale !== "fr" && locale !== "he") return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
