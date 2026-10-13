import type { MemberRoleCode } from "./constants";

/**
 * Matrice des droits (cahier des charges §2).
 *  - SUPER_ADMIN : accès global.
 *  - ORG_ADMIN : gestion complète de son association (hors forfaits SaaS).
 *  - SHOW_OPERATOR (« Utilisateur Show ») : Studio Show, Régie Live et Écran géant uniquement.
 */
export type Capability =
  | "org.view" // espace de gestion de l'association (dashboard, événements, dons)
  | "org.settings" // paramètres de l'association
  | "org.team" // gestion des administrateurs et utilisateurs Show
  | "org.billing.view" // consulter son forfait
  | "event.manage" // créer / modifier / supprimer un événement
  | "event.studio" // Studio Show
  | "event.regie" // Régie Live
  | "event.screen" // Écran géant
  | "platform.admin"; // Super Admin : associations, forfaits

export type Actor = { platformRole: "SUPER_ADMIN" | "USER"; memberRole: MemberRoleCode | null };

const ROLE_CAPABILITIES: Record<MemberRoleCode, Capability[]> = {
  ORG_ADMIN: [
    "org.view",
    "org.settings",
    "org.team",
    "org.billing.view",
    "event.manage",
    "event.studio",
    "event.regie",
    "event.screen",
  ],
  SHOW_OPERATOR: ["event.studio", "event.regie", "event.screen"],
};

export function can(actor: Actor, capability: Capability): boolean {
  if (actor.platformRole === "SUPER_ADMIN") return true;
  if (capability === "platform.admin") return false;
  if (!actor.memberRole) return false;
  return ROLE_CAPABILITIES[actor.memberRole].includes(capability);
}

export function capabilitiesOf(actor: Actor): Capability[] {
  if (actor.platformRole === "SUPER_ADMIN") {
    return [...ROLE_CAPABILITIES.ORG_ADMIN, "platform.admin"];
  }
  return actor.memberRole ? [...ROLE_CAPABILITIES[actor.memberRole]] : [];
}
