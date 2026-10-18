"use client";

import { useSyncExternalStore } from "react";
import { closestFormat, REFERENCE_FORMAT, type FormatId } from "@/lib/show/formats";

function subscribe(callback: () => void) {
  window.addEventListener("resize", callback);
  window.addEventListener("orientationchange", callback);
  return () => {
    window.removeEventListener("resize", callback);
    window.removeEventListener("orientationchange", callback);
  };
}

// Instantané : l'identifiant du format (chaîne stable), pas la taille de la fenêtre, pour ne
// rendre à nouveau la scène que lorsque le format change réellement.
const snapshot = () => closestFormat(window.innerWidth, window.innerHeight);
const serverSnapshot = () => null;

/**
 * Format d'écran de la fenêtre (le plus proche de son rapport largeur / hauteur), recalculé
 * au redimensionnement et à la rotation, sans rechargement. `forced` (paramètre `?format=`)
 * l'emporte. Côté serveur et à l'hydratation : 16:9.
 */
export function useScreenFormat(forced: FormatId | null = null): FormatId {
  const detected = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return forced ?? detected ?? REFERENCE_FORMAT;
}
