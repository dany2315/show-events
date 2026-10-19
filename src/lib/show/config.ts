import { z } from "zod";
import { ALT_FORMAT_IDS, getFormat, type AltFormatId, type FormatId } from "./formats";

/** Surface de référence du show (cahier des charges : 1920 × 1080, coordonnées proportionnelles). */
export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;

/** Dimensions d'une surface du show (une par format d'écran, voir `formats.ts`). */
export type StageSize = { width: number; height: number };
export const REFERENCE_STAGE: StageSize = { width: STAGE_WIDTH, height: STAGE_HEIGHT };

export const BLOCK_TYPES = ["logo", "title", "total", "goal", "donations", "message", "qrcode", "categories"] as const;
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

/** URL de média : fichier hébergé par la plateforme, Vercel Blob, lien https (MP4, WebM, GIF…) ou YouTube / Vimeo / Dailymotion. */
export const mediaUrlSchema = z
  .string()
  .max(500)
  .refine((v) => /^\/api\/media\/[a-z0-9]+$/i.test(v) || /^https:\/\/[^\s"'<>]+$/i.test(v), "URL de média invalide");

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

const blocksSchema = z.array(blockSchema).min(1).max(BLOCK_TYPES.length);

/**
 * Mises en page des formats d'écran secondaires (16:10, 4:3, 21:9, 32:9).
 * Chaque entrée est facultative : un format absent est dérivé automatiquement du 16:9
 * (`formatBlocks` dans `smart-layout.ts`). Les couleurs, l'arrière-plan, les textes,
 * les animations et la liste des dons restent communs à tous les formats.
 */
export const formatLayoutsSchema = z.partialRecord(z.enum(ALT_FORMAT_IDS), blocksSchema);
export type FormatLayouts = z.infer<typeof formatLayoutsSchema>;

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
  /** Mise en page principale, au format de référence 16:9 (champ historique). */
  blocks: blocksSchema,
  /** Mises en page personnalisées des autres formats d'écran (absentes des anciennes configurations). */
  layouts: formatLayoutsSchema.optional(),
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
  // Totaux par catégorie de donateurs : masqué tant que l'événement n'a pas de catégories ;
  // affiché, il prend le haut de la liste des dons (voir show/categories-layout.ts).
  { type: "categories", x: 37, y: 46.5, w: 59.8, h: 11, visible: false, align: "center", fontScale: 1 },
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
    blocks: DEFAULT_BLOCKS.map((b) => ({ ...b })),
  };
}

/**
 * Normalise une configuration venant de la base ou du client :
 * valeurs manquantes complétées, blocs inconnus retirés, blocs manquants ajoutés (masqués),
 * blocs maintenus dans la surface.
 * Les champs retirés des anciennes versions (fond image / vidéo, assombrissement, couleur de fond,
 * bloc vidéo et ses réglages) sont ignorés silencieusement.
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

  const layouts = normalizeFormatLayouts(raw.layouts, blocks);
  if (layouts) merged.layouts = layouts;

  const result = showConfigSchema.safeParse(merged);
  return result.success ? result.data : base;
}

/**
 * Mises en page des formats secondaires : formats inconnus et blocs invalides retirés,
 * doublons ignorés, blocs maintenus dans la surface. Un type de bloc absent (par exemple
 * ajouté après l'enregistrement) reprend la position du 16:9, masqué.
 * Renvoie `undefined` quand aucun format n'est personnalisé (anciennes configurations).
 */
function normalizeFormatLayouts(input: unknown, main: ShowBlock[]): FormatLayouts | undefined {
  if (!input || typeof input !== "object") return undefined;
  const raw = input as Record<string, unknown>;
  const layouts: FormatLayouts = {};
  for (const id of ALT_FORMAT_IDS) {
    const list = raw[id];
    if (!Array.isArray(list)) continue;
    const seen = new Set<BlockType>();
    const blocks: ShowBlock[] = [];
    for (const candidate of list) {
      const parsed = blockSchema.safeParse(candidate);
      if (!parsed.success || seen.has(parsed.data.type)) continue;
      seen.add(parsed.data.type);
      blocks.push(clampBlock(parsed.data));
    }
    if (blocks.length === 0) continue;
    for (const ref of main) {
      if (!seen.has(ref.type)) blocks.push({ ...ref, visible: false });
    }
    layouts[id] = blocks;
  }
  return Object.keys(layouts).length > 0 ? layouts : undefined;
}

/** Mise en page personnalisée d'un format secondaire, ou `null` si elle est dérivée du 16:9. */
export function customFormatBlocks(config: Pick<ShowConfig, "layouts">, format: FormatId): ShowBlock[] | null {
  if (format === "16:9") return null;
  return config.layouts?.[format as AltFormatId] ?? null;
}

/** Enregistre la mise en page d'un format (16:9 : mise en page principale). */
export function withFormatBlocks(config: ShowConfig, format: FormatId, blocks: ShowBlock[]): ShowConfig {
  if (format === "16:9") return { ...config, blocks };
  return { ...config, layouts: { ...config.layouts, [format]: blocks } };
}

/** Retire la mise en page personnalisée d'un format : elle redevient dérivée du 16:9. */
export function withoutFormatBlocks(config: ShowConfig, format: FormatId): ShowConfig {
  if (format === "16:9" || !config.layouts?.[format as AltFormatId]) return config;
  const rest: FormatLayouts = { ...config.layouts };
  delete rest[format as AltFormatId];
  const next: ShowConfig = { ...config };
  if (Object.keys(rest).length > 0) next.layouts = rest;
  else delete next.layouts;
  return next;
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

/** Dimensions de la surface d'un format d'écran. */
export function stageSize(format: FormatId | null | undefined): StageSize {
  const f = getFormat(format);
  return { width: f.width, height: f.height };
}

/** Conversion % → pixels de la surface (1920 × 1080 par défaut). */
export function blockToPixels(block: Pick<ShowBlock, "x" | "y" | "w" | "h">, stage: StageSize = REFERENCE_STAGE) {
  return {
    left: (block.x / 100) * stage.width,
    top: (block.y / 100) * stage.height,
    width: (block.w / 100) * stage.width,
    height: (block.h / 100) * stage.height,
  };
}

/** Conversion pixels → % (pour l'éditeur). */
export function pixelsToBlock(px: { left: number; top: number; width: number; height: number }, stage: StageSize = REFERENCE_STAGE) {
  return {
    x: (px.left / stage.width) * 100,
    y: (px.top / stage.height) * 100,
    w: (px.width / stage.width) * 100,
    h: (px.height / stage.height) * 100,
  };
}

/** Échelle à appliquer à la surface (1920 × 1080 par défaut) pour tenir dans un conteneur (letterbox). */
export function fitScale(containerWidth: number, containerHeight: number, stage: StageSize = REFERENCE_STAGE) {
  if (containerWidth <= 0 || containerHeight <= 0) return 0;
  return Math.min(containerWidth / stage.width, containerHeight / stage.height);
}
