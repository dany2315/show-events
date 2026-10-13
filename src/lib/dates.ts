import type { AppLocale } from "./constants";
import { intlLocale } from "./money";

const TIME_ZONE: Record<AppLocale, string> = { fr: "Europe/Paris", he: "Asia/Jerusalem" };

export function formatDate(date: Date | string, locale: AppLocale, withTime = true) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: "long",
    ...(withTime ? { timeStyle: "short" } : {}),
    timeZone: TIME_ZONE[locale],
  }).format(d);
}

export function formatShortDate(date: Date | string, locale: AppLocale) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short", year: "numeric", timeZone: TIME_ZONE[locale] }).format(d);
}

export function formatTime(date: Date | string, locale: AppLocale) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(intlLocale(locale), { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE[locale] }).format(d);
}

/** Valeur pour un champ <input type="datetime-local"> (heure locale du navigateur côté client). */
export function toDateTimeLocal(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
