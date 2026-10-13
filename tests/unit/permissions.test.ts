import { describe, expect, it } from "vitest";
import { can, capabilitiesOf, type Capability } from "@/lib/permissions";

const superAdmin = { platformRole: "SUPER_ADMIN" as const, memberRole: null };
const orgAdmin = { platformRole: "USER" as const, memberRole: "ORG_ADMIN" as const };
const operator = { platformRole: "USER" as const, memberRole: "SHOW_OPERATOR" as const };
const outsider = { platformRole: "USER" as const, memberRole: null };

describe("matrice des droits (cahier des charges §2)", () => {
  it("le Super Admin a tous les droits, y compris la gestion de la plateforme", () => {
    expect(can(superAdmin, "platform.admin")).toBe(true);
    expect(can(superAdmin, "org.team")).toBe(true);
    expect(can(superAdmin, "event.regie")).toBe(true);
  });

  it("l'administrateur gère son association mais pas la plateforme", () => {
    const allowed: Capability[] = ["org.view", "org.settings", "org.team", "event.manage", "event.studio", "event.regie", "event.screen"];
    for (const c of allowed) expect(can(orgAdmin, c)).toBe(true);
    expect(can(orgAdmin, "platform.admin")).toBe(false);
  });

  it("l'Utilisateur Show n'accède qu'au Studio, à la Régie et à l'Écran", () => {
    expect(capabilitiesOf(operator).sort()).toEqual(["event.regie", "event.screen", "event.studio"]);
    for (const c of ["org.view", "org.settings", "org.team", "org.billing.view", "event.manage", "platform.admin"] as Capability[]) {
      expect(can(operator, c)).toBe(false);
    }
  });

  it("un utilisateur sans appartenance n'a aucun droit", () => {
    expect(can(outsider, "event.screen")).toBe(false);
    expect(capabilitiesOf(outsider)).toEqual([]);
  });
});
