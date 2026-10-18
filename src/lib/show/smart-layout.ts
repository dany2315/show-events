import { clampBlock, type BlockType, type ShowBlock, type ShowConfig } from "./config";
import { carveCategories } from "./categories-layout";

/**
 * Moteur de mise en page intelligente du Studio (sans service externe, instantané).
 *  - 4 mises en page conçues pour que les 7 blocs coexistent sans chevauchement ;
 *  - choix automatique selon les blocs affichés ;
 *  - miroir automatique pour l'hébreu (lecture de droite à gauche) ;
 *  - détection et correction des chevauchements après un placement manuel.
 */
export const LAYOUT_PRESETS = ["classic", "spotlight", "donors", "minimal"] as const;
export type LayoutPreset = (typeof LAYOUT_PRESETS)[number];

type Rect = { x: number; y: number; w: number; h: number };
type PresetDef = {
  /** Le bloc « Catégories » n'a pas d'emplacement propre : il est taillé dans la liste des dons. */
  rects: Record<Exclude<BlockType, "categories">, Rect>;
  align?: Partial<Record<BlockType, ShowBlock["align"]>>;
  donations: ShowConfig["donations"];
};

const PRESETS: Record<LayoutPreset, PresetDef> = {
  // Classique : la disposition par défaut du show.
  classic: {
    rects: {
      logo: { x: 3.2, y: 5, w: 13.5, h: 19 },
      title: { x: 3.2, y: 28, w: 30, h: 34 },
      message: { x: 3.2, y: 70, w: 30, h: 24 },
      total: { x: 37, y: 5, w: 44.5, h: 26 },
      goal: { x: 37, y: 33, w: 44.5, h: 10 },
      donations: { x: 37, y: 46.5, w: 59.8, h: 48 },
      qrcode: { x: 84, y: 5, w: 12.8, h: 37 },
    },
    donations: { count: 8, columns: 2 },
  },
  spotlight: {
    rects: {
      logo: { x: 2.5, y: 4, w: 10, h: 14 },
      title: { x: 14, y: 5, w: 56, h: 11 },
      qrcode: { x: 84.5, y: 4, w: 13, h: 31 },
      total: { x: 10, y: 19, w: 66, h: 27 },
      goal: { x: 15, y: 48, w: 56, h: 10 },
      message: { x: 78, y: 38, w: 19, h: 20 },
      donations: { x: 4, y: 60, w: 93, h: 36 },
    },
    align: { total: "center", title: "start" },
    donations: { count: 6, columns: 2 },
  },
  donors: {
    rects: {
      donations: { x: 3, y: 4, w: 54, h: 92 },
      logo: { x: 60, y: 4, w: 16, h: 16 },
      qrcode: { x: 84, y: 4, w: 13, h: 31 },
      title: { x: 60, y: 22, w: 22, h: 14 },
      total: { x: 60, y: 38, w: 37, h: 20 },
      goal: { x: 60, y: 60, w: 37, h: 9 },
      message: { x: 60, y: 70, w: 37, h: 26 },
    },
    donations: { count: 12, columns: 1 },
  },
  minimal: {
    rects: {
      logo: { x: 44, y: 4, w: 12, h: 15 },
      title: { x: 20, y: 20, w: 60, h: 10 },
      total: { x: 10, y: 32, w: 80, h: 30 },
      goal: { x: 20, y: 64, w: 60, h: 9 },
      donations: { x: 3, y: 75, w: 60, h: 21 },
      message: { x: 65, y: 75, w: 17, h: 21 },
      qrcode: { x: 84, y: 62, w: 13, h: 34 },
    },
    align: { title: "center", total: "center" },
    donations: { count: 4, columns: 2 },
  },
};

/** Choisit la mise en page la plus adaptée aux blocs actuellement affichés. */
export function pickPreset(config: ShowConfig): LayoutPreset {
  const visible = new Set(config.blocks.filter((b) => b.visible).map((b) => b.type));
  if (!visible.has("donations")) return "minimal";
  if (config.donations.count >= 10) return "donors";
  if (!visible.has("title") && !visible.has("message")) return "spotlight";
  return "classic";
}

/**
 * Applique une mise en page : positions, tailles, colonnes de la liste des dons.
 * La visibilité choisie par l'utilisateur et l'ordre des calques sont conservés.
 * En hébreu, la mise en page est retournée (lecture de droite à gauche).
 */
export function applyPreset(config: ShowConfig, preset: LayoutPreset, rtl: boolean): ShowConfig {
  const def = PRESETS[preset];
  return {
    ...config,
    donations: { ...def.donations },
    blocks: carveCategories(
      config.blocks.map((block) => {
        if (block.type === "categories") return block;
        const rect = def.rects[block.type];
        const x = rtl ? 100 - rect.x - rect.w : rect.x;
        return clampBlock({ ...block, ...rect, x, align: def.align?.[block.type] ?? defaultAlign(block.type) });
      }),
      rtl,
    ),
  };
}

export function autoLayout(config: ShowConfig, rtl: boolean) {
  const preset = pickPreset(config);
  return { preset, config: applyPreset(config, preset, rtl) };
}

function defaultAlign(type: BlockType): ShowBlock["align"] {
  return type === "total" || type === "goal" || type === "qrcode" || type === "categories" ? "center" : "start";
}

/* ─── Chevauchements ──────────────────────────────────────────────────── */

const EPS = 0.25; // tolérance (en % de la surface) pour les bords qui se touchent

export function overlapArea(a: Rect, b: Rect) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > EPS && h > EPS ? w * h : 0;
}

/** Paires de blocs visibles qui se chevauchent. */
export function findOverlaps(blocks: ShowBlock[]): Array<[BlockType, BlockType]> {
  const visible = blocks.filter((b) => b.visible);
  const pairs: Array<[BlockType, BlockType]> = [];
  for (let i = 0; i < visible.length; i++) {
    for (let j = i + 1; j < visible.length; j++) {
      if (overlapArea(visible[i], visible[j]) > 0) pairs.push([visible[i].type, visible[j].type]);
    }
  }
  return pairs;
}

/**
 * Corrige les chevauchements en déplaçant les plus petits blocs vers l'emplacement libre
 * le plus proche (puis en les réduisant si la place manque). Les grands blocs restent fixes.
 */
export function fixOverlaps(config: ShowConfig): ShowConfig {
  const placed: ShowBlock[] = [];
  const order = [...config.blocks].filter((b) => b.visible).sort((a, b) => b.w * b.h - a.w * a.h);
  const result = new Map<BlockType, ShowBlock>();

  for (const block of order) {
    let candidate = block;
    if (placed.some((p) => overlapArea(p, candidate) > 0)) {
      candidate = findFreeSpot(block, placed) ?? block;
    }
    placed.push(candidate);
    result.set(block.type, candidate);
  }
  return { ...config, blocks: config.blocks.map((b) => result.get(b.type) ?? b) };
}

function findFreeSpot(block: ShowBlock, placed: ShowBlock[]): ShowBlock | null {
  for (const scale of [1, 0.85, 0.7, 0.55, 0.4]) {
    const w = Math.max(3, block.w * scale);
    const h = Math.max(3, block.h * scale);
    let best: { x: number; y: number; d: number } | null = null;
    for (let y = 0; y <= 100 - h + 1e-9; y += 1) {
      for (let x = 0; x <= 100 - w + 1e-9; x += 1) {
        const rect = { x, y, w, h };
        if (placed.some((p) => overlapArea(p, rect) > 0)) continue;
        const d = (x - block.x) ** 2 + (y - block.y) ** 2;
        if (!best || d < best.d) best = { x, y, d };
      }
    }
    if (best) return clampBlock({ ...block, x: best.x, y: best.y, w, h });
  }
  return null;
}
