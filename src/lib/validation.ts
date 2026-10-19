import { z } from "zod";
import {
  CURRENCIES,
  LOCALES,
  MAX_DONATION_AMOUNT,
  MAX_EMAIL_LENGTH,
  MAX_GOAL_AMOUNT,
  MAX_PERSON_NAME_LENGTH,
  MAX_PHONE_INPUT_LENGTH,
  MEMBER_ROLES,
  PLAN_TYPES,
  SUBSCRIPTION_STATUSES,
} from "./constants";
import { normalizePhone } from "./donor";

const amount = z.coerce.number().int().positive().max(MAX_DONATION_AMOUNT);
const idempotencyKey = z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/);
/** Catégorie de donateurs choisie (facultative) ; son appartenance à l'événement est vérifiée en base. */
const categoryId = z
  .string()
  .max(40)
  .nullish()
  .transform((v) => v || undefined);

/** Prénom / Nom du donateur. */
const personName = z.string().trim().min(1).max(MAX_PERSON_NAME_LENGTH);
/** Champ texte facultatif : une chaîne vide vaut « non renseigné ». */
const optionalPersonName = z
  .string()
  .trim()
  .max(MAX_PERSON_NAME_LENGTH)
  .optional()
  .transform((v) => v || undefined);

/** Téléphone international souple (chiffres, espaces, +, -, parenthèses ; 6 à 20 chiffres), normalisé. */
export const phoneSchema = z
  .string()
  .trim()
  .max(MAX_PHONE_INPUT_LENGTH)
  .transform((value, ctx) => {
    const phone = normalizePhone(value);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "Téléphone invalide" });
      return z.NEVER;
    }
    return phone;
  });

const optionalPhone = z
  .string()
  .trim()
  .max(MAX_PHONE_INPUT_LENGTH)
  .optional()
  .transform((value, ctx) => {
    if (!value) return undefined;
    const phone = normalizePhone(value);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "Téléphone invalide" });
      return z.NEVER;
    }
    return phone;
  });

/** E-mail facultatif, valide s'il est fourni. */
export const optionalEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(MAX_EMAIL_LENGTH)
  .optional()
  .refine((v) => !v || z.email().safeParse(v).success, "E-mail invalide")
  .transform((v) => v || undefined);

/**
 * Formulaire public : prénom, nom et téléphone obligatoires, e-mail facultatif.
 * « Anonyme » : le nom n'est pas affiché sur l'écran (les coordonnées restent transmises à l'organisateur).
 */
export const publicDonationSchema = z.object({
  firstName: personName,
  lastName: personName,
  phone: phoneSchema,
  email: optionalEmailSchema,
  anonymous: z.boolean().default(false),
  categoryId,
  amount,
  idempotencyKey,
  /** Champ piège invisible : rempli uniquement par les robots. */
  website: z.string().max(200).optional(),
});

/**
 * Saisie Régie : l'opérateur saisit vite pendant le direct, téléphone et e-mail sont facultatifs.
 * Prénom et nom sont obligatoires, sauf pour un donateur annoncé « Anonyme » (souvent inconnu).
 */
export const manualDonationSchema = z
  .object({
    firstName: optionalPersonName,
    lastName: optionalPersonName,
    phone: optionalPhone,
    email: optionalEmailSchema,
    anonymous: z.boolean().default(false),
    categoryId,
    amount,
    isFictitious: z.boolean().default(false),
    idempotencyKey,
  })
  .superRefine((v, ctx) => {
    if (v.anonymous) return;
    if (!v.firstName) ctx.addIssue({ code: "custom", path: ["firstName"], message: "Prénom requis" });
    if (!v.lastName) ctx.addIssue({ code: "custom", path: ["lastName"], message: "Nom requis" });
  });

export const updateDonationSchema = z
  .object({
    firstName: optionalPersonName,
    lastName: optionalPersonName,
    anonymous: z.boolean().optional(),
    /** Catégorie de donateurs : chaîne vide ou null pour la retirer. */
    categoryId: z
      .string()
      .max(40)
      .nullable()
      .optional()
      .transform((v) => (v === "" ? null : v)),
    amount: amount.optional(),
    isFictitious: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined));

export const controlSchema = z.object({
  action: z.enum(["pause", "resume", "overlay", "clearOverlay", "celebrate", "goal", "videoStart", "videoMute", "videoStop"]),
  message: z.string().trim().max(160).optional(),
  /** Intermède vidéo : vidéo préparée (videoId) ou lien lancé en direct (url, titre facultatif). */
  videoId: z.string().min(1).max(64).optional(),
  url: z.string().trim().max(2048).optional(),
  title: z.string().trim().max(80).optional(),
  muted: z.boolean().optional(),
});

/** Signalement de l'écran géant pendant un intermède vidéo (fin de lecture, son bloqué / rétabli). */
export const screenVideoReportSchema = z.object({
  action: z.enum(["ended", "soundBlocked", "soundOk"]),
  runId: z.string().min(1).max(64),
});

/** Adresse web acceptée pour une redirection : http ou https uniquement (jamais javascript:, data:…). */
export function isSafeWebUrl(value: string) {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Lien de la campagne de dons (facultatif) : vide = aucun lien. */
export const campaignUrlSchema = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => v || null)
  .refine((v) => v === null || isSafeWebUrl(v), "Lien invalide");

export const eventInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  date: z.coerce.date(),
  goalAmount: z.coerce.number().int().positive().max(MAX_GOAL_AMOUNT),
  currency: z.enum(CURRENCIES),
  locale: z.enum(LOCALES),
  campaignUrl: campaignUrlSchema,
});

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const memberInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(160),
  role: z.enum(MEMBER_ROLES),
});

export const planInputSchema = z.object({
  plan: z.enum(PLAN_TYPES),
  status: z.enum(SUBSCRIPTION_STATUSES),
  eventCredits: z.coerce.number().int().min(0).max(10_000),
  currentPeriodEnd: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : null)),
  notes: z.string().max(1000).optional(),
});

export function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
