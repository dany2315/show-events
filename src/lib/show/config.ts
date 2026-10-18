import { z } from "zod";

/** Surface de référence du show (cahier des charges : 1920 × 1080, coordonnées proportionnelles). */
export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;

export const BLOCK_TYPES = ["logo", "title", "total", "goal", "donations", "message", "qrcode", "video"] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

/**
 * Bibliothèque d'arrière-plans proposés par la plateforme (identifiants stables, stockés en base).
 * L'ordre est celui de l'affichage dans le Studio, la création d'événement et la page d'accueil.
 * Les 5 premiers identifiants historiques (gala, moderne, minimal, feerie, nature) restent valides.
 */
export const THEME_IDS = [
  "gala",
  "velours",
  "artdeco",
  "marbre",
  "jerusalem",
  "royal",
  "emeraude",
  "aurore",
  "feerie",
  "feux",
  "sunset",
  "nature",
  "moderne",
  "minimal",
] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const DONATION_ANIMATIONS = ["slide", "pop", "spotlight", "fade"] as const;
export type DonationAnimation = (typeof DONATION_ANIMATIONS)[number];

export const COUNTER_ANIMATIONS = ["roll", "instant"] as const;
export type CounterAnimation = (typeof COUNTER_ANIMATIONS)[number];

export const ALIGNMENTS = ["start", "center", "end"] as const;
export type Alignment = (typeof ALIGNMENTS)[number];

const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{6})$/)
  .nullable();

const pct = z.number().min(0).max(100);

/** URL de média : fichier hébergé par la plateforme, Vercel Blob, lien https (MP4, WebM, GIF…) ou YouTube / Vimeo. */
export const mediaUrlSchema = z
  .string()
  .max(500)
  .refine((v) => /^\/api\/media\/[a-z0-9]+$/i.test(v) || /^https:\/\/[^\s"'<>]+$/i.test(v), "URL de média invalide");

export const VIDEO_FITS = ["cover", "contain"] as const;

export const blockSchema = z.object({
  type: z.enum(BLOCK_TYPES),
  /** Position et taille en % de la surface de référence. */
  x: pct,
  y: pct,
  w: z.number().min(3).max(100),
  h: z.number().min(3).max(100),
  visible: z.boolean(),
  align: z.enum(ALIGNMENTS),
  /** Facteur de taille du texte (0,5 à 2). */
  fontScale: z.number().min(0.5).max(2),
});
export type ShowBlock = z.infer<typeof blockSchema>;

export const showConfigSchema = z.object({
  version: z.literal(1),
  /** Arrière-plan choisi dans la bibliothèque de la plateforme (champ historique « theme »). */
  theme: z.enum(THEME_IDS),
  /** Couleurs personnalisées des éléments (le décor garde la palette de l'arrière-plan). */
  colors: z.object({
    accent: hexColor,
    text: hexColor,
  }),
  animation: z.object({
    donation: z.enum(DONATION_ANIMATIONS),
    counter: z.enum(COUNTER_ANIMATIONS),
    milestones: z.boolean(),
    /** À partir de ce montant, une promesse est mise en lumière plein écran. 0 = jamais. */
    spotlightThreshold: z.number().int().min(0).max(100_000_000),
    ambient: z.boolean(),
  }),
  texts: z.object({
    subtitle: z.string().max(160),
    message: z.string().max(400),
    totalLabel: z.string().max(60),
    donationsLabel: z.string().max(60),
    qrLabel: z.string().max(80),
  }),
  donations: z.object({
    count: z.number().int().min(1).max(16),
    columns: z.union([z.literal(1), z.literal(2)]),
  }),
  /** Bloc vidéo (MP4/WebM importé, lien direct, YouTube ou Vimeo). */
  video: z.object({
    url: mediaUrlSchema.nullable(),
    muted: z.boolean(),
    loop: z.boolean(),
    fit: z.enum(VIDEO_FITS),
  }),
  blocks: z.array(blockSchema).min(1).max(BLOCK_TYPES.length),
});
export type ShowConfig = z.infer<typeof showConfigSchema>;

export const DEFAULT_BLOCKS: ShowBlock[] = [
  { type: "logo", x: 3.2, y: 5, w: 13.5, h: 19, visible: true, align: "start", fontScale: 1 },
  { type: "title", x: 3.2, y: 28, w: 30, h: 34, visible: true, align: "start", fontScale: 1 },
  { type: "message", x: 3.2, y: 70, w: 30, h: 24, visible: true, align: "start", fontScale: 1 },
  { type: "total", x: 37, y: 5, w: 44.5, h: 26, visible: true, align: "center", fontScale: 1 },
  { type: "goal", x: 37, y: 33, w: 44.5, h: 10, visible: true, align: "center", fontScale: 1 },
  { type: "donations", x: 37, y: 46.5, w: 59.8, h: 48, visible: true, align: "start", fontScale: 1 },
  { type: "qrcode", x: 84, y: 5, w: 12.8, h: 37, visible: true, align: "center", fontScale: 1 },
  { type: "video", x: 3.2, y: 49, w: 30, h: 24, visible: false, align: "center", fontScale: 1 },
];

export function defaultShowConfig(theme: ThemeId = "gala"): ShowConfig {
  return {
    version: 1,
    theme,
    colors: { accent: null, text: null },
    animation: {
      donation: "slide",
      counter: "roll",
      milestones: true,
      spotlightThreshold: 0,
      ambient: true,
    },
    texts: { subtitle: "", message: "", totalLabel: "", donationsLabel: "", qrLabel: "" },
    donations: { count: 8, columns: 2 },
    video: { url: null, muted: true, loop: true, fit: "cover" },
    blocks: DEFAULT_BLOCKS.map((b) => ({ ...b })),
  };
}

/**
 * Normalise une configuration venant de la base ou du client :
 * valeurs manquantes complétées, blocs inconnus retirés, blocs manquants ajoutés (masqués),
 * blocs maintenus dans la surface.
 * Les champs retirés des anciennes versions (fond image / vidéo, assombrissement, couleur de fond)
 * sont ignorés silencieusement.
 */
export function normalizeShowConfig(input: unknown): ShowConfig {
  const base = defaultShowConfig();
  if (!input || typeof input !== "object") return base;
  const raw = input as Partial<ShowConfig> & Record<string, unknown>;

  const theme = THEME_IDS.includes(raw.theme as ThemeId) ? (raw.theme as ThemeId) : base.theme;
  const merged: ShowConfig = {
    ...base,
    theme,
    colors: { accent: pickColor(raw.colors, "accent"), text: pickColor(raw.colors, "text") },
    animation: { ...base.animation, ...(raw.animation ?? {}) },
    texts: { ...base.texts, ...(raw.texts ?? {}) },
    donations: { ...base.donations, ...(raw.donations ?? {}) },
    video: { ...base.video, ...(raw.video ?? {}) },
    blocks: [],
  };

  const seen = new Set<BlockType>();
  const blocks: ShowBlock[] = [];
  for (const candidate of Array.isArray(raw.blocks) ? raw.blocks : []) {
    const parsed = blockSchema.safeParse(candidate);
    if (!parsed.success || seen.has(parsed.data.type)) continue;
    seen.add(parsed.data.type);
    blocks.push(clampBlock(parsed.data));
  }
  for (const def of DEFAULT_BLOCKS) {
    if (!seen.has(def.type)) blocks.push({ ...def, visible: blocks.length === 0 ? def.visible : false });
  }
  merged.blocks = blocks;

  const result = showConfigSchema.safeParse(merged);
  return result.success ? result.data : base;
}

function pickColor(colors: unknown, key: "accent" | "text"): string | null {
  if (!colors || typeof colors !== "object") return null;
  const value = (colors as Record<string, unknown>)[key];
  return typeof value === "string" && hexColor.safeParse(value).success ? value : null;
}

export function clampBlock(block: ShowBlock): ShowBlock {
  const w = Math.min(100, Math.max(3, block.w));
  const h = Math.min(100, Math.max(3, block.h));
  const x = Math.min(100 - w, Math.max(0, block.x));
  const y = Math.min(100 - h, Math.max(0, block.y));
  const round = (n: number) => Math.round(n * 100) / 100;
  return { ...block, x: round(x), y: round(y), w: round(w), h: round(h) };
}

/** Conversion % → pixels de la surface de référence. */
export function blockToPixels(block: Pick<ShowBlock, "x" | "y" | "w" | "h">) {
  return {
    left: (block.x / 100) * STAGE_WIDTH,
    top: (block.y / 100) * STAGE_HEIGHT,
    width: (block.w / 100) * STAGE_WIDTH,
    height: (block.h / 100) * STAGE_HEIGHT,
  };
}

/** Conversion pixels → % (pour l'éditeur). */
export function pixelsToBlock(px: { left: number; top: number; width: number; height: number }) {
  return {
    x: (px.left / STAGE_WIDTH) * 100,
    y: (px.top / STAGE_HEIGHT) * 100,
    w: (px.width / STAGE_WIDTH) * 100,
    h: (px.height / STAGE_HEIGHT) * 100,
  };
}

/** Échelle à appliquer à la surface 1920×1080 pour tenir dans un conteneur (letterbox). */
export function fitScale(containerWidth: number, containerHeight: number) {
  if (containerWidth <= 0 || containerHeight <= 0) return 0;
  return Math.min(containerWidth / STAGE_WIDTH, containerHeight / STAGE_HEIGHT);
}
