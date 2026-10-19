/**
 * Mode démo (variable d'environnement DEMO_MODE=1) : chaque visiteur obtient un espace
 * de démonstration isolé, connecté sans identifiants, effacé automatiquement après 24 h.
 * Sans la variable, l'application se comporte normalement et les routes de démo renvoient 404.
 *
 * Module sans dépendance : importé par la configuration d'authentification comme par les pages.
 */
export function isDemoMode() {
  const value = process.env.DEMO_MODE?.trim().toLowerCase();
  return value === "1" || value === "true";
}

/** Domaine réservé (RFC 2606) des comptes de démonstration : jamais joignable, jamais d'e-mail envoyé. */
export const DEMO_EMAIL_DOMAIN = "demo.pyramide.invalid";

/** Durée de vie d'un espace de démo. */
export const DEMO_TTL_MS = 24 * 60 * 60 * 1000;

/** Préfixe des identifiants (slug) des associations de démo. */
export const DEMO_SLUG_PREFIX = "demo-";

export function isDemoEmail(email: string | null | undefined) {
  return Boolean(email && email.toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`));
}

/** Nombre d'espaces de démo qu'une même adresse IP peut créer par heure (DEMO_SPACES_PER_HOUR, défaut 10). */
export function demoSpacesPerHour() {
  const value = Number(process.env.DEMO_SPACES_PER_HOUR);
  return Number.isInteger(value) && value > 0 ? value : 10;
}

/** Garde-fous d'un espace de démo (limites visibles, voir le bandeau et les messages). */
export const DEMO_LIMITS = {
  /** Événements par espace de démo (le gala de démonstration compris). */
  events: 5,
  /** Images importées par espace (logos, fonds) ; les vidéos s'ajoutent par lien uniquement. */
  media: 20,
  /** Taille maximale d'une image importée en démo. */
  imageBytes: 1024 * 1024,
  /** Promesses par événement au-delà desquelles la simulation s'arrête. */
  donationsPerEvent: 400,
} as const;
