/**
 * Formats d'écran pris en charge par le show.
 *
 * Le 16:9 (1920 × 1080) reste la surface de référence : c'est la mise en page principale,
 * celle des aperçus (Studio, Régie, page d'accueil) et des vignettes. Les autres formats
 * ont leur propre surface (même hauteur de référence de 1080 px) et une mise en page
 * facultative : en son absence, elle est dérivée automatiquement du 16:9 (voir
 * `smart-layout.ts`). Pas de format portrait : l'écran du show est toujours couché ; une
 * fenêtre en portrait prend le format le plus proche (4:3), avec des bandes noires.
 */
export const FORMAT_IDS = ["16:9", "16:10", "4:3", "21:9", "32:9"] as const;
export type FormatId = (typeof FORMAT_IDS)[number];

/** Format de référence : mise en page principale (champ historique `blocks`). */
export const REFERENCE_FORMAT: FormatId = "16:9";

/** Formats secondaires : mise en page facultative (champ `layouts`). */
export const ALT_FORMAT_IDS = ["16:10", "4:3", "21:9", "32:9"] as const satisfies readonly FormatId[];
export type AltFormatId = (typeof ALT_FORMAT_IDS)[number];

export type ScreenFormat = {
  id: FormatId;
  /** Libellé complet (sélecteur du Studio, infobulles). */
  label: { fr: string; he: string };
  /** Dimensions de la surface du show, en pixels CSS avant mise à l'échelle. */
  width: number;
  height: number;
};

export const SCREEN_FORMATS: Record<FormatId, ScreenFormat> = {
  "16:9": { id: "16:9", label: { fr: "16:9 · Écran standard (Full HD, 4K)", he: "16:9 · מסך סטנדרטי (Full HD / 4K)" }, width: 1920, height: 1080 },
  "16:10": { id: "16:10", label: { fr: "16:10 · Projecteur WUXGA, écran d'ordinateur", he: "16:10 · מקרן WUXGA, מסך מחשב" }, width: 1920, height: 1200 },
  "4:3": { id: "4:3", label: { fr: "4:3 · Projecteur classique", he: "4:3 · מקרן קלאסי" }, width: 1440, height: 1080 },
  "21:9": { id: "21:9", label: { fr: "21:9 · Écran ultra-large", he: "21:9 · מסך אולטרה-רחב" }, width: 2520, height: 1080 },
  "32:9": { id: "32:9", label: { fr: "32:9 · Double écran, bandeau LED", he: "32:9 · מסך כפול, רצועת לד" }, width: 3840, height: 1080 },
};

export const FORMAT_LIST: ScreenFormat[] = FORMAT_IDS.map((id) => SCREEN_FORMATS[id]);

export function isFormatId(value: unknown): value is FormatId {
  return typeof value === "string" && (FORMAT_IDS as readonly string[]).includes(value);
}

export function getFormat(id: FormatId | null | undefined): ScreenFormat {
  return (id && SCREEN_FORMATS[id]) || SCREEN_FORMATS[REFERENCE_FORMAT];
}

/**
 * Format dont le rapport largeur / hauteur est le plus proche de la fenêtre.
 * Les rapports sont comparés en logarithme : 2:1 est aussi éloigné de 1:1 que 1:2.
 */
export function closestFormat(width: number, height: number): FormatId {
  if (!(width > 0) || !(height > 0)) return REFERENCE_FORMAT;
  const ratio = Math.log(width / height);
  let best: FormatId = REFERENCE_FORMAT;
  let distance = Infinity;
  for (const f of FORMAT_LIST) {
    const d = Math.abs(Math.log(f.width / f.height) - ratio);
    if (d < distance - 1e-9) {
      best = f.id;
      distance = d;
    }
  }
  return best;
}

const ALIASES: Record<string, FormatId> = {
  paysage: "16:9",
  landscape: "16:9",
  standard: "16:9",
  hd: "16:9",
  ultrawide: "21:9",
  "ultra-large": "21:9",
  superwide: "32:9",
  "super-large": "32:9",
  projecteur: "4:3",
  projector: "4:3",
};

/**
 * Lit le paramètre d'URL `?format=` de l'écran géant : `21:9`, `21x9`, `21-9`, `21/9`
 * ou un alias (`ultrawide`, `projecteur`…). Renvoie `null` si la valeur est absente ou inconnue
 * (le format est alors détecté d'après la taille de la fenêtre).
 */
export function parseFormatParam(value: string | string[] | null | undefined): FormatId | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (ALIASES[v]) return ALIASES[v];
  const normalized = v.replace(/[x×/\-_ ]/g, ":");
  return isFormatId(normalized) ? normalized : null;
}
