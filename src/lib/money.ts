import type { AppLocale, CurrencyCode } from "./constants";

const INTL_LOCALE: Record<AppLocale, string> = { fr: "fr-FR", he: "he-IL" };

const formatters = new Map<string, Intl.NumberFormat>();

function getFormatter(locale: AppLocale, currency: CurrencyCode, compact = false) {
  const key = `${locale}:${currency}:${compact}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(INTL_LOCALE[locale], {
      style: "currency",
      currency,
      maximumFractionDigits: compact ? 1 : 0,
      minimumFractionDigits: 0,
      notation: compact ? "compact" : "standard",
    });
    formatters.set(key, formatter);
  }
  return formatter;
}

/** Formate un montant entier dans la devise de l'événement (ex. « 126 000 € », « ‏126,000 ₪ »). */
export function formatMoney(amount: number, currency: CurrencyCode, locale: AppLocale = "fr") {
  return getFormatter(locale, currency).format(amount);
}

export function formatMoneyCompact(amount: number, currency: CurrencyCode, locale: AppLocale = "fr") {
  return getFormatter(locale, currency, true).format(amount);
}

export function formatNumber(value: number, locale: AppLocale = "fr") {
  return new Intl.NumberFormat(INTL_LOCALE[locale], { maximumFractionDigits: 0 }).format(value);
}

export const CURRENCY_SYMBOL: Record<CurrencyCode, string> = { EUR: "€", ILS: "₪", USD: "$" };

/**
 * Convertit une saisie utilisateur en montant entier.
 * Accepte « 1 500 », « 1.500 », « 1,500 », « 1500 € »… Retourne null si invalide.
 */
export function parseAmountInput(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") {
    return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : null;
  }
  const cleaned = raw.replace(/[\s  €$₪]/g, "").replace(/[.,](?=\d{3}(\D|$))/g, "");
  if (!/^\d+([.,]\d{1,2})?$/.test(cleaned)) return null;
  const value = Math.round(Number(cleaned.replace(",", ".")));
  return value > 0 ? value : null;
}

/** Progression vers l'objectif, bornée entre 0 et 100 (le total peut dépasser l'objectif). */
export function goalProgress(total: number, goal: number) {
  if (!goal || goal <= 0) return 0;
  return Math.max(0, Math.min(100, (total / goal) * 100));
}

export function formatPercent(value: number, locale: AppLocale = "fr") {
  return new Intl.NumberFormat(INTL_LOCALE[locale], { maximumFractionDigits: 0 }).format(value) + "%";
}

export function intlLocale(locale: AppLocale) {
  return INTL_LOCALE[locale];
}
