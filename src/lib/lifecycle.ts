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
