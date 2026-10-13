import { describe, expect, it } from "vitest";
import { checkEventCreation, checkGoLive, defaultPeriodEnd } from "@/lib/billing";

const now = new Date("2026-10-13T12:00:00Z");
const pass = (credits: number) => ({ plan: "EVENT_PASS" as const, status: "ACTIVE" as const, eventCredits: credits, currentPeriodEnd: null });
const pro = (end: string | null) => ({ plan: "PRO_MONTHLY" as const, status: "ACTIVE" as const, eventCredits: 0, currentPeriodEnd: end ? new Date(end) : null });

describe("création d'événement (§11) : gratuite, crédit consommé au passage en direct", () => {
  it("autorisée même sans crédit restant (préparation et test illimités)", () => {
    expect(checkEventCreation(pass(0), true, now)).toEqual({ allowed: true });
    expect(checkEventCreation(pro("2026-11-01"), true, now)).toEqual({ allowed: true });
  });

  it("refusée sans forfait actif, abonnement expiré ou association suspendue", () => {
    expect(checkEventCreation(null, true, now)).toEqual({ allowed: false, reason: "NO_SUBSCRIPTION" });
    expect(checkEventCreation({ ...pass(3), status: "CANCELED" }, true, now)).toEqual({ allowed: false, reason: "INACTIVE" });
    expect(checkEventCreation(pro("2026-01-01"), true, now)).toEqual({ allowed: false, reason: "EXPIRED" });
    expect(checkEventCreation(pass(3), false, now)).toEqual({ allowed: false, reason: "ORG_SUSPENDED" });
  });
});

describe("passage en direct", () => {
  it("paiement par événement : consomme un crédit, refusé sans crédit", () => {
    expect(checkGoLive(pass(2), true, false, now)).toEqual({ allowed: true, consumesCredit: true });
    expect(checkGoLive(pass(0), true, false, now)).toEqual({ allowed: false, reason: "NO_CREDITS" });
  });

  it("abonnement actif : aucun crédit consommé ; expiré : refusé", () => {
    expect(checkGoLive(pro("2026-11-01"), true, false, now)).toEqual({ allowed: true, consumesCredit: false });
    expect(checkGoLive(pro("2026-01-01"), true, false, now)).toEqual({ allowed: false, reason: "EXPIRED" });
  });

  it("un seul crédit par événement : déjà consommé, plus jamais débité", () => {
    expect(checkGoLive(pass(0), true, true, now)).toEqual({ allowed: true, consumesCredit: false });
  });

  it("association suspendue : refusé, même si le crédit est déjà consommé", () => {
    expect(checkGoLive(pass(5), false, true, now)).toEqual({ allowed: false, reason: "ORG_SUSPENDED" });
  });

  it("calcule la fin de période des abonnements", () => {
    expect(defaultPeriodEnd("PRO_MONTHLY", now)?.toISOString().slice(0, 10)).toBe("2026-11-13");
    expect(defaultPeriodEnd("PRO_YEARLY", now)?.toISOString().slice(0, 10)).toBe("2027-10-13");
    expect(defaultPeriodEnd("EVENT_PASS", now)).toBeNull();
  });
});
