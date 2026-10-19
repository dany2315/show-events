import { MAX_DONOR_NAME_LENGTH, MAX_PHONE_INPUT_LENGTH, PHONE_DIGITS } from "./constants";

/**
 * Identité du donateur (module partagé client / serveur, sans dépendance à la base).
 *
 *  - Prénom et Nom sont saisis séparément ; le nom affiché sur l'écran est « Prénom Nom »,
 *    ou « Anonyme » (dans la langue de l'événement) si le donateur l'a choisi.
 *  - Téléphone et e-mail ne servent qu'à l'organisateur : jamais affichés ni diffusés.
 */

/** Retire les caractères de contrôle et les chevrons, normalise les espaces. */
export function cleanText(raw: string, max: number) {
  return raw
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function sanitizeDonorName(raw: string) {
  return cleanText(raw, MAX_DONOR_NAME_LENGTH);
}

/** Nom affiché sur l'écran (null si les noms manquent sans anonymat). */
export function displayDonorName(input: { firstName?: string | null; lastName?: string | null; anonymous?: boolean }, anonymousLabel: string) {
  if (input.anonymous) return anonymousLabel;
  const name = sanitizeDonorName(`${input.firstName ?? ""} ${input.lastName ?? ""}`);
  return name || null;
}

/** Saisie acceptée : chiffres, espaces, tirets, parenthèses, et un « + » initial. */
const PHONE_INPUT = /^\+?[\d\s\-()]+$/;

/**
 * Téléphone international souple, normalisé pour le stockage : « +33 6 12-34 (56) 78 » → « +33612345678 ».
 * Renvoie null si la saisie est invalide (caractères interdits, ou moins de 6 / plus de 20 chiffres).
 */
export function normalizePhone(raw: string): string | null {
  const value = raw.trim();
  if (!value || value.length > MAX_PHONE_INPUT_LENGTH || !PHONE_INPUT.test(value)) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < PHONE_DIGITS.min || digits.length > PHONE_DIGITS.max) return null;
  return (value.startsWith("+") ? "+" : "") + digits;
}

/** Contrôle d'e-mail côté client (le serveur revalide avec zod). */
export function looksLikeEmail(raw: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw.trim());
}

/** Anciennes promesses (nom unique) : proposition de prénom / nom pour la correction. */
export function splitDonorName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return { firstName: parts[0] ?? "", lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}
