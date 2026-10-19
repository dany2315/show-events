import { APP_NAME, BRAND_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

/*
 * Logo Pyramide (piste « Pyramidion ») — tracés repris tels quels du kit officiel (logo/svg).
 * Le nom est dessiné : ne jamais le recomposer dans une police.
 * Deux dessins : « sur fond sombre » (or sur nuit, compensation optique) et « sur fond clair » (nuit + or sur papier).
 * Règles du guide : jamais d'or seul sur fond clair ; horizontal ≥ 120 px de large ; symbole ≥ 24 px,
 * en dessous utiliser la coupe « petite taille » ; zone de protection = hauteur de la pierre de faîte.
 */

const HORIZONTAL = {
  onDark: {
    viewBox: "0 0 1032 256",
    capstone: "M 147.8 0 L 184.01 62.72 L 111.59 62.72 Z",
    tiers: "M 92.17 98.56 L 203.43 98.56 L 225.6 136.96 L 70 136.96 Z M 58.19 157.44 L 237.41 157.44 L 259.58 195.84 L 36.02 195.84 Z M 24.19 216.32 L 271.41 216.32 L 293.58 254.72 L 2.02 254.72 Z",
    word: "M 359.6 97.28 L 368.99 97.28 L 368.99 197.12 L 359.6 197.12 Z M 364.3 97.28 H 391.55 A 27.96 27.96 0 0 1 391.55 153.19 H 364.3 V 144.74 H 391.55 A 18.57 19.51 0 0 0 391.55 105.73 H 364.3 Z M 440.47 97.28 L 450.76 97.28 L 476.75 142.27 L 502.72 97.28 L 513.02 97.28 L 481.43 151.99 L 481.43 197.12 L 472.05 197.12 L 472.05 151.99 Z M 537.98 97.28 L 547.37 97.28 L 547.37 197.12 L 537.98 197.12 Z M 542.67 97.28 H 571.93 A 27.96 27.96 0 0 1 571.93 153.19 H 542.67 V 144.74 H 571.93 A 18.57 19.51 0 0 0 571.93 105.73 H 542.67 Z M 561.24 148.97 L 572.08 148.97 L 599.88 197.12 L 589.06 197.12 Z M 648.6 97.28 L 658.32 97.28 L 631.56 197.12 L 621.85 197.12 Z M 648.6 97.28 L 658.32 97.28 L 685.07 197.12 L 675.35 197.12 Z M 634.61 159.18 L 672.31 159.18 L 672.31 167.63 L 634.61 167.63 Z M 709.03 97.28 L 718.41 97.28 L 718.41 197.12 L 709.03 197.12 Z M 787.51 97.28 L 796.89 97.28 L 796.89 197.12 L 787.51 197.12 Z M 709.03 97.28 L 718.26 97.28 L 757.57 197.12 L 748.35 197.12 Z M 787.66 97.28 L 796.89 97.28 L 757.57 197.12 L 748.35 197.12 Z M 830.84 97.28 L 840.22 97.28 L 840.22 197.12 L 830.84 197.12 Z M 874.16 97.28 L 883.55 97.28 L 883.55 197.12 L 874.16 197.12 Z M 878.86 97.28 H 898.12 A 49.92 49.92 0 0 1 898.12 197.12 H 878.86 V 188.67 H 898.12 A 40.54 41.47 0 0 0 898.12 105.73 H 878.86 Z M 978 97.28 L 987.38 97.28 L 987.38 197.12 L 978 197.12 Z M 978 97.28 L 1031.91 97.28 L 1031.91 105.73 L 978 105.73 Z M 978 142.98 L 1026.52 142.98 L 1026.52 151.42 L 978 151.42 Z M 978 188.67 L 1031.91 188.67 L 1031.91 197.12 L 978 197.12 Z",
  },
  onLight: {
    viewBox: "0 0 1034 256",
    capstone: "M 147.8 0 L 184.76 64 L 110.85 64 Z",
    tiers: "M 91.64 97.28 L 203.97 97.28 L 227.61 138.24 L 67.99 138.24 Z M 57.64 156.16 L 237.96 156.16 L 261.61 197.12 L 34 197.12 Z M 23.65 215.04 L 271.95 215.04 L 295.6 256 L 0 256 Z",
    word: "M 359.6 97.28 L 369.59 97.28 L 369.59 197.12 L 359.6 197.12 Z M 364.6 97.28 H 391.55 A 27.96 27.96 0 0 1 391.55 153.19 H 364.6 V 144.2 H 391.55 A 17.97 18.97 0 0 0 391.55 106.27 H 364.6 Z M 440.47 97.28 L 451.43 97.28 L 477.07 141.71 L 502.72 97.28 L 513.68 97.28 L 482.06 152.04 L 482.06 197.12 L 472.08 197.12 L 472.08 152.04 Z M 538.64 97.28 L 548.62 97.28 L 548.62 197.12 L 538.64 197.12 Z M 543.63 97.28 H 572.58 A 27.96 27.96 0 0 1 572.58 153.19 H 543.63 V 144.2 H 572.58 A 17.97 18.97 0 0 0 572.58 106.27 H 543.63 Z M 561.05 148.7 L 572.58 148.7 L 600.54 197.12 L 589 197.12 Z M 649.25 97.28 L 659.6 97.28 L 632.84 197.12 L 622.5 197.12 Z M 649.25 97.28 L 659.6 97.28 L 686.35 197.12 L 676.01 197.12 Z M 635.43 159.18 L 673.42 159.18 L 673.42 168.17 L 635.43 168.17 Z M 710.31 97.28 L 720.29 97.28 L 720.29 197.12 L 710.31 197.12 Z M 788.19 97.28 L 798.17 97.28 L 798.17 197.12 L 788.19 197.12 Z M 710.31 97.28 L 720.12 97.28 L 759.16 197.12 L 749.32 197.12 Z M 788.35 97.28 L 798.17 97.28 L 759.16 197.12 L 749.32 197.12 Z M 832.12 97.28 L 842.1 97.28 L 842.1 197.12 L 832.12 197.12 Z M 876.04 97.28 L 886.03 97.28 L 886.03 197.12 L 876.04 197.12 Z M 881.04 97.28 H 900.01 A 49.92 49.92 0 0 1 900.01 197.12 H 881.04 V 188.13 H 900.01 A 39.94 40.93 0 0 0 900.01 106.27 H 881.04 Z M 979.88 97.28 L 989.86 97.28 L 989.86 197.12 L 979.88 197.12 Z M 979.88 97.28 L 1033.79 97.28 L 1033.79 106.27 L 979.88 106.27 Z M 979.88 142.71 L 1028.4 142.71 L 1028.4 151.69 L 979.88 151.69 Z M 979.88 188.13 L 1033.79 188.13 L 1033.79 197.12 L 979.88 197.12 Z",
  },
} as const;

const SYMBOL = {
  onDark: {
    viewBox: "0 0 256 256",
    capstone: "M128 26 L156.29 75 L99.71 75 Z",
    tiers: "M84.54 103 L171.46 103 L188.78 133 L67.22 133 Z M57.99 149 L198.01 149 L215.33 179 L40.67 179 Z M31.43 195 L224.57 195 L241.89 225 L14.11 225 Z",
  },
  onLight: {
    viewBox: "0 0 256 256",
    capstone: "M128 26 L156.87 76 L99.13 76 Z",
    tiers: "M84.12 102 L171.88 102 L190.35 134 L65.65 134 Z M57.56 148 L198.44 148 L216.91 180 L39.09 180 Z M31.01 194 L224.99 194 L243.47 226 L12.53 226 Z",
  },
} as const;

const SYMBOL_SMALL = {
  onDark: {
    viewBox: "0 0 256 256",
    capstone: "M128 24 L159.75 79 L96.25 79 Z",
    tiers: "M82.23 105 L173.77 105 L200.32 151 L55.68 151 Z M40.67 177 L215.33 177 L246.51 231 L9.49 231 Z",
  },
  onLight: {
    viewBox: "0 0 256 256",
    capstone: "M128 24 L160.33 80 L95.67 80 Z",
    tiers: "M81.81 104 L174.19 104 L201.9 152 L54.1 152 Z M40.24 176 L215.76 176 L248.09 232 L7.91 232 Z",
  },
} as const;

const FILLS = {
  onDark: { capstone: BRAND_COLORS.orClair, tiers: BRAND_COLORS.or, word: BRAND_COLORS.ivoire },
  onLight: { capstone: BRAND_COLORS.or, tiers: BRAND_COLORS.nuit, word: BRAND_COLORS.nuit },
} as const;

/**
 * `tone` décrit la couleur du logo rendu : « light » (or sur nuit) pour les fonds sombres,
 * « dark » (nuit + or) pour les fonds clairs. `mono` : une seule couleur (`currentColor`).
 */
type BrandProps = { className?: string; tone?: "dark" | "light"; mono?: boolean; decorative?: boolean };

function a11y(decorative?: boolean) {
  return decorative ? ({ "aria-hidden": true } as const) : ({ role: "img", "aria-label": APP_NAME } as const);
}

/** Logo horizontal (symbole + nom dessiné). 32 px de haut par défaut (≈ 129 px de large, au-dessus du minimum de 120 px). */
export function Brand({ className, tone = "dark", mono = false, decorative = false }: BrandProps) {
  const key = tone === "light" ? "onDark" : "onLight";
  const art = HORIZONTAL[key];
  const fill = mono ? null : FILLS[key];
  return (
    <svg viewBox={art.viewBox} className={cn("block h-8 w-auto shrink-0", className)} {...a11y(decorative)}>
      <path fill={fill?.capstone ?? "currentColor"} d={art.capstone} />
      <path fill={fill?.tiers ?? "currentColor"} d={art.tiers} />
      <path fill={fill?.word ?? "currentColor"} d={art.word} />
    </svg>
  );
}

/** Symbole seul. `small` : coupe « petite taille » (pierre + 2 assises), obligatoire sous 24 px. */
export function BrandMark({ className, tone = "dark", mono = false, decorative = true, small = false }: BrandProps & { small?: boolean }) {
  const key = tone === "light" ? "onDark" : "onLight";
  const art = (small ? SYMBOL_SMALL : SYMBOL)[key];
  const fill = mono ? null : FILLS[key];
  return (
    <svg viewBox={art.viewBox} className={cn("block size-8 shrink-0", className)} {...a11y(decorative)}>
      <path fill={fill?.capstone ?? "currentColor"} d={art.capstone} />
      <path fill={fill?.tiers ?? "currentColor"} d={art.tiers} />
    </svg>
  );
}
