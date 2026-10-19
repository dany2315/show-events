import type { EventStatusCode } from "./constants";

/**
 * Cycle de vie d'un événement :
 *
 *   DRAFT ──► TEST ──► LIVE ──► ENDED (définitif)
 *     │  ◄──   │        ▲
 *     └────────┴────────┘
 *
 *  - DRAFT : préparation (Studio). Aucune promesse acceptée.
 *  - TEST  : répétition complète (régie, écran, QR code), sans crédit.
 *            Les promesses de test sont effacées au passage en direct.
 *  - LIVE  : le vrai gala. Le crédit est consommé (une seule fois par événement).
 *  - ENDED : collecte close, définitivement. Seul le Super Admin peut rouvrir (support).
 */
const TRANSITIONS: Record<EventStatusCode, EventStatusCode[]> = {
  DRAFT: ["TEST", "LIVE"],
  TEST: ["DRAFT", "LIVE"],
  LIVE: ["ENDED"],
  ENDED: [],
};

export function allowedTransitions(from: EventStatusCode, isSuperAdmin = false): EventStatusCode[] {
  if (from === "ENDED" && isSuperAdmin) return ["LIVE"];
  return TRANSITIONS[from];
}

export function canTransition(from: EventStatusCode, to: EventStatusCode, isSuperAdmin = false) {
  return allowedTransitions(from, isSuperAdmin).includes(to);
}

/** Les promesses ne sont acceptées qu'en test et en direct. */
export function acceptsDonations(status: EventStatusCode) {
  return status === "TEST" || status === "LIVE";
}

/**
 * Mode test : au plus 10 promesses de test (non supprimées) par événement, toutes sources confondues
 * (formulaire public et Régie). Vérifié atomiquement en base (src/lib/donations.ts).
 */
export const TEST_DONATION_LIMIT = 10;

/** Nombre de promesses de test encore possibles (null hors mode test : aucune limite). */
export function testDonationsRemaining(status: EventStatusCode, testCount: number): number | null {
  if (status !== "TEST") return null;
  return Math.max(0, TEST_DONATION_LIMIT - testCount);
}
