import type { PlanTypeCode, SubscriptionStatusCode } from "./constants";

export type SubscriptionSnapshot = {
  plan: PlanTypeCode;
  status: SubscriptionStatusCode;
  eventCredits: number;
  currentPeriodEnd: Date | null;
};

export type BillingRefusal = "NO_SUBSCRIPTION" | "INACTIVE" | "EXPIRED" | "NO_CREDITS" | "ORG_SUSPENDED";

export type EventCreationCheck = { allowed: true } | { allowed: false; reason: BillingRefusal };

export type GoLiveCheck = { allowed: true; consumesCredit: boolean } | { allowed: false; reason: BillingRefusal };

/**
 * Règles de commercialisation (cahier des charges §11) :
 *  - Abonnement (PRO_MONTHLY / PRO_YEARLY) : événements illimités pendant la période.
 *  - Paiement par événement (EVENT_PASS) et essai (TRIAL) : un crédit par événement.
 *
 * Le crédit est consommé au PASSAGE EN DIRECT (pas à la création) : créer, préparer
 * et tester un événement est gratuit et illimité.
 */
function subscriptionRefusal(sub: SubscriptionSnapshot | null, orgActive: boolean, now: Date): BillingRefusal | null {
  if (!orgActive) return "ORG_SUSPENDED";
  if (!sub) return "NO_SUBSCRIPTION";
  if (sub.status !== "ACTIVE") return "INACTIVE";
  if (isSubscriptionPlan(sub.plan) && sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() < now.getTime()) return "EXPIRED";
  return null;
}

export function checkEventCreation(sub: SubscriptionSnapshot | null, orgActive: boolean, now: Date = new Date()): EventCreationCheck {
  const refusal = subscriptionRefusal(sub, orgActive, now);
  return refusal ? { allowed: false, reason: refusal } : { allowed: true };
}

/** Passage en direct : consomme un crédit (sauf abonnement, ou crédit déjà utilisé par cet événement). */
export function checkGoLive(
  sub: SubscriptionSnapshot | null,
  orgActive: boolean,
  creditAlreadyConsumed: boolean,
  now: Date = new Date(),
): GoLiveCheck {
  if (!orgActive) return { allowed: false, reason: "ORG_SUSPENDED" };
  if (creditAlreadyConsumed) return { allowed: true, consumesCredit: false };
  const refusal = subscriptionRefusal(sub, orgActive, now);
  if (refusal) return { allowed: false, reason: refusal };
  if (isSubscriptionPlan(sub!.plan)) return { allowed: true, consumesCredit: false };
  if (sub!.eventCredits <= 0) return { allowed: false, reason: "NO_CREDITS" };
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
