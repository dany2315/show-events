import { describe, expect, it } from "vitest";
import { acceptsDonations, allowedTransitions, canTransition, TEST_DONATION_LIMIT, testDonationsRemaining } from "@/lib/lifecycle";

describe("cycle de vie d'un événement", () => {
  it("préparation → test ou direct", () => {
    expect(allowedTransitions("DRAFT").sort()).toEqual(["LIVE", "TEST"]);
  });

  it("test → retour en préparation ou direct", () => {
    expect(allowedTransitions("TEST").sort()).toEqual(["DRAFT", "LIVE"]);
  });

  it("direct → uniquement terminé (pas de retour en test ni en préparation)", () => {
    expect(allowedTransitions("LIVE")).toEqual(["ENDED"]);
    expect(canTransition("LIVE", "DRAFT")).toBe(false);
    expect(canTransition("LIVE", "TEST")).toBe(false);
  });

  it("terminé est définitif pour l'association", () => {
    expect(allowedTransitions("ENDED")).toEqual([]);
    expect(canTransition("ENDED", "LIVE")).toBe(false);
  });

  it("seul le Super Admin peut rouvrir un événement terminé (support)", () => {
    expect(canTransition("ENDED", "LIVE", true)).toBe(true);
    expect(canTransition("ENDED", "TEST", true)).toBe(false);
  });

  it("les promesses ne sont acceptées qu'en test et en direct", () => {
    expect(acceptsDonations("DRAFT")).toBe(false);
    expect(acceptsDonations("TEST")).toBe(true);
    expect(acceptsDonations("LIVE")).toBe(true);
    expect(acceptsDonations("ENDED")).toBe(false);
  });

  it("le mode test est limité à 10 promesses", () => {
    expect(TEST_DONATION_LIMIT).toBe(10);
    expect(testDonationsRemaining("TEST", 0)).toBe(10);
    expect(testDonationsRemaining("TEST", 7)).toBe(3);
    expect(testDonationsRemaining("TEST", 10)).toBe(0);
    expect(testDonationsRemaining("TEST", 12)).toBe(0);
  });

  it("aucune limite hors mode test", () => {
    expect(testDonationsRemaining("LIVE", 5000)).toBeNull();
    expect(testDonationsRemaining("DRAFT", 3)).toBeNull();
    expect(testDonationsRemaining("ENDED", 3)).toBeNull();
  });
});
