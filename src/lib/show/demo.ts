import { dictionaries } from "@/i18n/dictionaries";
import type { AppLocale, CurrencyCode } from "../constants";
import type { LiveEventInfo, PublicDonation } from "../live/types";
import { defaultShowConfig, type ShowConfig, type ThemeId } from "./config";

/** Données d'exemple pour les aperçus (page d'accueil, Studio, galerie de styles). */
export function demoEvent(locale: AppLocale, overrides: Partial<LiveEventInfo> = {}): LiveEventInfo {
  const t = dictionaries[locale].landing;
  return {
    id: "demo",
    name: t.demoEvent,
    date: new Date("2026-06-01T19:30:00Z").toISOString(),
    currency: (locale === "he" ? "ILS" : "EUR") as CurrencyCode,
    locale,
    goalAmount: locale === "he" ? 900_000 : 200_000,
    status: "LIVE",
    logoUrl: null,
    organizationName: t.demoOrg,
    ...overrides,
  };
}

export function demoDonations(locale: AppLocale, scale = 1): PublicDonation[] {
  const names = dictionaries[locale].landing.demoDonors;
  const amounts = [5000, 1800, 2500, 10000, 500, 1000, 3600, 750];
  return names.map((donorName, i) => ({
    id: `demo-${i}`,
    donorName,
    amount: Math.round(amounts[i % amounts.length] * scale),
    createdAt: new Date(Date.UTC(2026, 5, 1, 19, 30 + i)).toISOString(),
  }));
}

export function demoConfig(theme: ThemeId, locale: AppLocale): ShowConfig {
  const config = defaultShowConfig(theme);
  const t = dictionaries[locale].landing;
  config.texts.message = t.demoMessage;
  config.texts.subtitle = locale === "he" ? "יחד למען עתיד טוב יותר" : "Ensemble pour un avenir meilleur";
  return config;
}
