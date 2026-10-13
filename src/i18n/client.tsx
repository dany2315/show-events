"use client";

import { createContext, useContext } from "react";
import type { AppLocale } from "@/lib/constants";
import { dictionaries, type Dictionary } from "./dictionaries";

type I18nValue = { locale: AppLocale; t: Dictionary; dir: "ltr" | "rtl" };

const I18nContext = createContext<I18nValue>({ locale: "fr", t: dictionaries.fr, dir: "ltr" });

export function I18nProvider({ locale, children }: { locale: AppLocale; children: React.ReactNode }) {
  return (
    <I18nContext.Provider value={{ locale, t: dictionaries[locale], dir: locale === "he" ? "rtl" : "ltr" }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
