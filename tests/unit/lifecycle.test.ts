import { describe, expect, it } from "vitest";
import { acceptsDonations, allowedTransitions, canTransition } from "@/lib/lifecycle";

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
});
