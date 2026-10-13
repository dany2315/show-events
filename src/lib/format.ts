import type { Currency } from "@/lib/types";

const localeByCurrency: Record<Currency, string> = {
  EUR: "fr-FR",
  ILS: "he-IL",
  USD: "en-US",
};

export function formatMoney(amount: number, currency: Currency) {
  return new Intl.NumberFormat(localeByCurrency[currency], {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function pct(value: number, max: number) {
  if (max <= 0) return 0;
  return Math.min(100, Math.round((value / max) * 100));
}
