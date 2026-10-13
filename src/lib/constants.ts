export const APP_NAME = "Fundraising Live";

export const CURRENCIES = ["EUR", "ILS", "USD"] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

export const LOCALES = ["fr", "he"] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "fr";
export const LOCALE_COOKIE = "fl_locale";

export const MEMBER_ROLES = ["ORG_ADMIN", "SHOW_OPERATOR"] as const;
export type MemberRoleCode = (typeof MEMBER_ROLES)[number];

export const EVENT_STATUSES = ["DRAFT", "LIVE", "ENDED"] as const;
export type EventStatusCode = (typeof EVENT_STATUSES)[number];

export const PLAN_TYPES = ["TRIAL", "EVENT_PASS", "PRO_MONTHLY", "PRO_YEARLY"] as const;
export type PlanTypeCode = (typeof PLAN_TYPES)[number];

export const SUBSCRIPTION_STATUSES = ["ACTIVE", "PAST_DUE", "CANCELED", "EXPIRED"] as const;
export type SubscriptionStatusCode = (typeof SUBSCRIPTION_STATUSES)[number];

/**
 * Boutons de montants rapides de la Régie, par devise.
 * En shekels, les multiples de 18 (« Haï ») sont une convention répandue lors des galas.
 */
export const QUICK_AMOUNTS: Record<CurrencyCode, number[]> = {
  EUR: [100, 500, 1000, 5000],
  USD: [100, 500, 1000, 5000],
  ILS: [180, 360, 1800, 3600],
};

/** Montants suggérés sur le formulaire mobile. */
export const SUGGESTED_AMOUNTS: Record<CurrencyCode, number[]> = {
  EUR: [50, 100, 250, 500, 1000, 2500],
  USD: [50, 100, 250, 500, 1000, 2500],
  ILS: [180, 360, 500, 1000, 1800, 3600],
};

/** Plafond de sécurité d'une promesse (évite les fautes de frappe absurdes). */
export const MAX_DONATION_AMOUNT = 10_000_000;
export const MAX_GOAL_AMOUNT = 1_000_000_000;
export const MAX_DONOR_NAME_LENGTH = 60;

/** Limite anti-abus du formulaire public : nombre de promesses par appareil et par minute. */
export const PUBLIC_RATE_LIMIT = { max: 5, windowMs: 60_000 };

/** Taille maximale d'un logo / image importé. */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"];

/** Grille tarifaire SaaS (hypothèses commerciales du cahier des charges, modifiables). */
export const PLAN_CATALOG: Record<PlanTypeCode, { price: number; period: "event" | "month" | "year" | "trial"; credits: number }> = {
  TRIAL: { price: 0, period: "trial", credits: 1 },
  EVENT_PASS: { price: 149, period: "event", credits: 1 },
  PRO_MONTHLY: { price: 79, period: "month", credits: 0 },
  PRO_YEARLY: { price: 790, period: "year", credits: 0 },
};
