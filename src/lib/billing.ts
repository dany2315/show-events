import type { PlanTypeCode, SubscriptionStatusCode } from "./constants";

export type SubscriptionSnapshot = {
  plan: PlanTypeCode;
  status: SubscriptionStatusCode;
  eventCredits: number;
  currentPeriodEnd: Date | null;
};

export type EventCreationCheck =
  | { allowed: true; consumesCredit: boolean }
  | { allowed: false; reason: "NO_SUBSCRIPTION" | "INACTIVE" | "EXPIRED" | "NO_CREDITS" | "ORG_SUSPENDED" };

/**
 * Règles de commercialisation (cahier des charges §11) :
 *  - Abonnement (PRO_MONTHLY / PRO_YEARLY) : événements illimités pendant la période.
 *  - Paiement par événement (EVENT_PASS) et essai (TRIAL) : un crédit consommé par événement créé.
 */
export function checkEventCreation(
  sub: SubscriptionSnapshot | null,
  orgActive: boolean,
  now: Date = new Date(),
): EventCreationCheck {
  if (!orgActive) return { allowed: false, reason: "ORG_SUSPENDED" };
  if (!sub) return { allowed: false, reason: "NO_SUBSCRIPTION" };
  if (sub.status !== "ACTIVE") return { allowed: false, reason: "INACTIVE" };
  if (sub.plan === "PRO_MONTHLY" || sub.plan === "PRO_YEARLY") {
    if (sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() < now.getTime()) {
      return { allowed: false, reason: "EXPIRED" };
    }
    return { allowed: true, consumesCredit: false };
  }
  if (sub.eventCredits <= 0) return { allowed: false, reason: "NO_CREDITS" };
  return { allowed: true, consumesCredit: true };
}

export function isSubscriptionPlan(plan: PlanTypeCode) {
  return plan === "PRO_MONTHLY" || plan === "PRO_YEARLY";
}

export function defaultPeriodEnd(plan: PlanTypeCode, from: Date = new Date()): Date | null {
  if (plan === "PRO_MONTHLY") {
    const d = new Date(from);
    d.setMonth(d.getMonth() + 1);
    return d;
  }
  if (plan === "PRO_YEARLY") {
    const d = new Date(from);
    d.setFullYear(d.getFullYear() + 1);
    return d;
  }
  return null;
}
