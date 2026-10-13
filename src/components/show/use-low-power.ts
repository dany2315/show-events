"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(pointer: coarse), (max-width: 900px), (prefers-reduced-motion: reduce)";

function subscribe(callback: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

/**
 * Vrai sur téléphone / tablette (ou si l'utilisateur réduit les animations).
 * Les aperçus du show y coupent les effets décoratifs : Safari iOS ferme l'onglet
 * quand la mémoire graphique est saturée par des animations continues.
 */
export function useLowPower() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
