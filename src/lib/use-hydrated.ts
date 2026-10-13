"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Vrai une fois React hydraté. Les boutons d'envoi restent désactivés avant :
 * une soumission HTML native (avant hydratation) enverrait les champs dans l'URL.
 */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
