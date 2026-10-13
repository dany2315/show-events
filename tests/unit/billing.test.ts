import { describe, expect, it } from "vitest";
import { checkEventCreation, defaultPeriodEnd } from "@/lib/billing";

const now = new Date("2026-10-13T12:00:00Z");

describe("création d'événement selon le forfait (§11)", () => {
  it("abonnement actif : illimité, sans consommer de crédit", () => {
    expect(checkEventCreation({ plan: "PRO_MONTHLY", status: "ACTIVE", eventCredits: 0, currentPeriodEnd: new Date("2026-11-01") }, true, now)).toEqual({
      allowed: true,
      consumesCredit: false,
    });
  });

  it("abonnement expiré : refusé", () => {
    expect(checkEventCreation({ plan: "PRO_YEARLY", status: "ACTIVE", eventCredits: 0, currentPeriodEnd: new Date("2026-01-01") }, true, now)).toEqual({
      allowed: false,
      reason: "EXPIRED",
    });
  });

  it("paiement par événement : consomme un crédit, refusé sans crédit", () => {
    expect(checkEventCreation({ plan: "EVENT_PASS", status: "ACTIVE", eventCredits: 2, currentPeriodEnd: null }, true, now)).toEqual({ allowed: true, consumesCredit: true });
    expect(checkEventCreation({ plan: "EVENT_PASS", status: "ACTIVE", eventCredits: 0, currentPeriodEnd: null }, true, now)).toEqual({ allowed: false, reason: "NO_CREDITS" });
  });

  it("forfait inactif, absent ou association suspendue : refusé", () => {
    expect(checkEventCreation({ plan: "TRIAL", status: "CANCELED", eventCredits: 1, currentPeriodEnd: null }, true, now)).toEqual({ allowed: false, reason: "INACTIVE" });
    expect(checkEventCreation(null, true, now)).toEqual({ allowed: false, reason: "NO_SUBSCRIPTION" });
    expect(checkEventCreation({ plan: "PRO_MONTHLY", status: "ACTIVE", eventCredits: 0, currentPeriodEnd: null }, false, now)).toEqual({ allowed: false, reason: "ORG_SUSPENDED" });
  });

  it("calcule la fin de période des abonnements", () => {
    expect(defaultPeriodEnd("PRO_MONTHLY", now)?.toISOString().slice(0, 10)).toBe("2026-11-13");
    expect(defaultPeriodEnd("PRO_YEARLY", now)?.toISOString().slice(0, 10)).toBe("2027-10-13");
    expect(defaultPeriodEnd("EVENT_PASS", now)).toBeNull();
  });
});
