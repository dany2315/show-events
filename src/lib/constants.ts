export const APP_NAME = "Pyramide";
/** Palette de la marque (kit « couleurs ») : nuit, or, or clair, ivoire. */
export const BRAND_COLORS = { nuit: "#14111f", or: "#c9973f", orClair: "#f1cf7e", ivoire: "#f8f6f2" } as const;
/** Adresse de contact affichée sur la vitrine et la page de connexion (domaine à confirmer avant la mise en production). */
export const CONTACT_EMAIL = "contact@pyramide.app";
/** Lien fictif encodé dans le QR code de l'aperçu (Studio, démonstrations) quand aucun lien réel n'existe. */
export const PREVIEW_FORM_URL = "https://pyramide.app/d/apercu";

export const CURRENCIES = ["EUR", "ILS", "USD"] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

export const LOCALES = ["fr", "he"] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "fr";
export const LOCALE_COOKIE = "fl_locale";

export const MEMBER_ROLES = ["ORG_ADMIN", "SHOW_OPERATOR"] as const;
export type MemberRoleCode = (typeof MEMBER_ROLES)[number];

export const EVENT_STATUSES = ["DRAFT", "TEST", "LIVE", "ENDED"] as const;
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
/** Prénom et nom du donateur (le nom affiché « Prénom Nom » reste limité à MAX_DONOR_NAME_LENGTH). */
export const MAX_PERSON_NAME_LENGTH = 40;
export const MAX_EMAIL_LENGTH = 160;
/** Téléphone international souple : de 6 à 20 chiffres (indicatif compris). */
export const PHONE_DIGITS = { min: 6, max: 20 } as const;
export const MAX_PHONE_INPUT_LENGTH = 32;

/** Limite anti-abus du formulaire public : nombre de promesses par appareil et par minute. */
/**
 * Limites anti-abus du formulaire public, par événement et par minute :
 *  - par appareil (cookie anonyme) : un même téléphone ne peut pas inonder le show ;
 *  - par adresse IP : plafond large, car tout le Wi-Fi d'une salle (500 invités et plus)
 *    sort souvent sur Internet avec une seule et même IP.
 */
export const PUBLIC_RATE_LIMIT = { perDevice: 5, perIp: 600, windowMs: 60_000 };

/** Taille maximale d'un logo / image importé. */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"];
/** Vidéos stockées en base (sans stockage externe) : limité par la taille maximale d'une requête Vercel. */
export const MAX_VIDEO_UPLOAD_BYTES = 4 * 1024 * 1024;
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm"];
/** Avec Vercel Blob (BLOB_READ_WRITE_TOKEN) : envoi direct depuis le navigateur, sans passer par le serveur. */
export const MAX_BLOB_UPLOAD_BYTES = 300 * 1024 * 1024;

/** Grille tarifaire SaaS (hypothèses commerciales du cahier des charges, modifiables). */
export const PLAN_CATALOG: Record<PlanTypeCode, { price: number; period: "event" | "month" | "year" | "trial"; credits: number }> = {
  TRIAL: { price: 0, period: "trial", credits: 1 },
  EVENT_PASS: { price: 149, period: "event", credits: 1 },
  PRO_MONTHLY: { price: 79, period: "month", credits: 0 },
  PRO_YEARLY: { price: 790, period: "year", credits: 0 },
};
