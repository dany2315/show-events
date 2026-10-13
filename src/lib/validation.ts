import { z } from "zod";
import { CURRENCIES, LOCALES, MAX_DONATION_AMOUNT, MAX_DONOR_NAME_LENGTH, MAX_GOAL_AMOUNT, MEMBER_ROLES, PLAN_TYPES, SUBSCRIPTION_STATUSES } from "./constants";

const amount = z.coerce.number().int().positive().max(MAX_DONATION_AMOUNT);
const donorName = z.string().trim().min(1).max(MAX_DONOR_NAME_LENGTH);
const idempotencyKey = z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/);

export const publicDonationSchema = z.object({
  donorName,
  amount,
  idempotencyKey,
  /** Champ piège invisible : rempli uniquement par les robots. */
  website: z.string().max(200).optional(),
});

export const manualDonationSchema = z.object({
  donorName,
  amount,
  isFictitious: z.boolean().default(false),
  idempotencyKey,
});

export const updateDonationSchema = z
  .object({
    donorName: donorName.optional(),
    amount: amount.optional(),
    isFictitious: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0);

export const controlSchema = z.object({
  action: z.enum(["pause", "resume", "overlay", "clearOverlay", "celebrate", "goal"]),
  message: z.string().trim().max(160).optional(),
});

export const eventInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  date: z.coerce.date(),
  goalAmount: z.coerce.number().int().positive().max(MAX_GOAL_AMOUNT),
  currency: z.enum(CURRENCIES),
  locale: z.enum(LOCALES),
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
