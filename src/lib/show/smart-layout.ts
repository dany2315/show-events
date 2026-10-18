import { clampBlock, customFormatBlocks, type BlockType, type ShowBlock, type ShowConfig } from "./config";
import { getFormat, type FormatId } from "./formats";

/**
 * Moteur de mise en page intelligente du Studio (sans service externe, instantané).
 *  - 4 mises en page conçues pour que les 7 blocs coexistent sans chevauchement ;
 *  - choix automatique selon les blocs affichés ;
 *  - miroir automatique pour l'hébreu (lecture de droite à gauche) ;
 *  - détection et correction des chevauchements après un placement manuel ;
 *  - une mise en page par format d'écran, dérivée automatiquement du 16:9 tant qu'elle
 *    n'est pas personnalisée (voir « Formats d'écran » plus bas).
 */
export const LAYOUT_PRESETS = ["classic", "spotlight", "donors", "minimal"] as const;
export type LayoutPreset = (typeof LAYOUT_PRESETS)[number];

type Rect = { x: number; y: number; w: number; h: number };
type PresetDef = {
  rects: Record<BlockType, Rect>;
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
 *
 * `config.blocks` est la mise en page du format visé (`format`, 16:9 par défaut).
 * Les réglages de la liste des dons (nombre, colonnes) sont communs à tous les formats :
 * seul le format de référence 16:9 les modifie.
 */
export function applyPreset(config: ShowConfig, preset: LayoutPreset, rtl: boolean, format: FormatId = "16:9"): ShowConfig {
  if (format === "16:9") return { ...config, donations: { ...PRESETS[preset].donations }, blocks: presetBlocks(config.blocks, preset, rtl) };
  if (FAMILY[format] === "proportional") return { ...config, blocks: presetBlocks(config.blocks, preset, rtl) };
  return { ...config, blocks: composeBlocks(config.blocks, preset, format, rtl, false) };
}

function presetBlocks(blocks: ShowBlock[], preset: LayoutPreset, rtl: boolean): ShowBlock[] {
  const def = PRESETS[preset];
  return blocks.map((block) => {
    const rect = def.rects[block.type];
    const x = rtl ? 100 - rect.x - rect.w : rect.x;
    return clampBlock({ ...block, ...rect, x, align: def.align?.[block.type] ?? defaultAlign(block.type) });
  });
}

export function autoLayout(config: ShowConfig, rtl: boolean, format: FormatId = "16:9") {
  const preset = pickPreset(config);
  return { preset, config: applyPreset(config, preset, rtl, format) };
}

/** Mise en page 16:9 correspondant exactement à l'une des mises en page proposées (sinon `null`). */
export function matchPreset(blocks: ShowBlock[], rtl: boolean): LayoutPreset | null {
  const visible = blocks.filter((b) => b.visible);
  if (visible.length === 0) return null;
  const near = (a: number, b: number) => Math.abs(a - b) < 0.6;
  for (const preset of LAYOUT_PRESETS) {
    const rects = PRESETS[preset].rects;
    const same = visible.every((b) => {
      const r = rects[b.type];
      if (!r) return false;
      const x = rtl ? 100 - r.x - r.w : r.x;
      return near(b.x, x) && near(b.y, r.y) && near(b.w, r.w) && near(b.h, r.h);
    });
    if (same) return preset;
  }
  return null;
}

function defaultAlign(type: BlockType): ShowBlock["align"] {
  return type === "total" || type === "goal" || type === "qrcode" ? "center" : "start";
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

/* ─── Formats d'écran ─────────────────────────────────────────────────── */

/**
 * Familles de formats :
 *  - « proportional » (16:10, 4:3) : rapport proche du 16:9, la mise en page en % est reprise
 *    telle quelle (la disposition choisie par l'utilisateur est conservée, sans chevauchement nouveau) ;
 *  - « portrait » (9:16) : empilement vertical lisible, du logo en haut au QR code en bas ;
 *  - « wide » (21:9) et « ultrawide » (32:9) : répartition horizontale en colonnes.
 */
type FormatFamily = "proportional" | "portrait" | "wide" | "ultrawide";
const FAMILY: Record<FormatId, FormatFamily> = {
  "16:9": "proportional",
  "16:10": "proportional",
  "4:3": "proportional",
  "21:9": "wide",
  "32:9": "ultrawide",
  "9:16": "portrait",
};

/** Ligne d'une pile : blocs côte à côte, hauteur de base (% de la hauteur utile) et part de l'espace libre. */
type Row = { types: BlockType[]; h: number; grow?: number; align?: ShowBlock["align"] };
/** Colonne : largeur relative et pile de lignes ; `center` : groupe centré verticalement, sans étirement. */
type Column = { weight: number; rows: Row[]; center?: boolean };

const PORTRAIT: Record<LayoutPreset, Row[]> = {
  classic: [
    { types: ["logo"], h: 7, align: "center" },
    { types: ["title"], h: 10, grow: 0.3, align: "center" },
    { types: ["total"], h: 12, grow: 0.4 },
    { types: ["goal"], h: 5 },
    { types: ["donations"], h: 30, grow: 1 },
    { types: ["message", "qrcode"], h: 14, grow: 0.2 },
  ],
  spotlight: [
    { types: ["logo", "title"], h: 9 },
    { types: ["total"], h: 19, grow: 0.5 },
    { types: ["goal"], h: 6 },
    { types: ["donations"], h: 28, grow: 1 },
    { types: ["message", "qrcode"], h: 14 },
  ],
  donors: [
    { types: ["logo", "title"], h: 8 },
    { types: ["total"], h: 10, grow: 0.2 },
    { types: ["goal"], h: 4.5 },
    { types: ["donations"], h: 46, grow: 1 },
    { types: ["message", "qrcode"], h: 12 },
  ],
  minimal: [
    { types: ["logo"], h: 9, align: "center" },
    { types: ["title"], h: 9, grow: 0.2, align: "center" },
    { types: ["total"], h: 22, grow: 0.6 },
    { types: ["goal"], h: 6 },
    { types: ["donations"], h: 16, grow: 0.4 },
    { types: ["message", "qrcode"], h: 18 },
  ],
};

const WIDE: Record<LayoutPreset, Column[]> = {
  classic: [
    { weight: 0.25, rows: [{ types: ["logo"], h: 22 }, { types: ["title"], h: 40, grow: 1 }, { types: ["message"], h: 28 }] },
    { weight: 0.56, rows: [{ types: ["total"], h: 28 }, { types: ["goal"], h: 10 }, { types: ["donations"], h: 50, grow: 1 }] },
    { weight: 0.16, center: true, rows: [{ types: ["qrcode"], h: 46 }] },
  ],
  spotlight: [
    { weight: 0.2, rows: [{ types: ["logo"], h: 20 }, { types: ["title"], h: 34, grow: 1 }, { types: ["message"], h: 30 }] },
    { weight: 0.6, rows: [{ types: ["total"], h: 38, grow: 0.5 }, { types: ["goal"], h: 11 }, { types: ["donations"], h: 40, grow: 1 }] },
    { weight: 0.16, center: true, rows: [{ types: ["qrcode"], h: 50 }] },
  ],
  donors: [
    { weight: 0.44, rows: [{ types: ["donations"], h: 100, grow: 1 }] },
    {
      weight: 0.38,
      rows: [
        { types: ["logo"], h: 18 },
        { types: ["title"], h: 20, grow: 0.3 },
        { types: ["total"], h: 26, grow: 0.3 },
        { types: ["goal"], h: 10 },
        { types: ["message"], h: 16, grow: 0.3 },
      ],
    },
    { weight: 0.16, center: true, rows: [{ types: ["qrcode"], h: 50 }] },
  ],
  minimal: [
    { weight: 0.24, center: true, rows: [{ types: ["logo"], h: 22 }, { types: ["title"], h: 26 }, { types: ["message"], h: 30 }] },
    { weight: 0.56, rows: [{ types: ["total"], h: 46, grow: 1 }, { types: ["goal"], h: 12 }, { types: ["donations"], h: 30, grow: 0.4 }] },
    { weight: 0.16, center: true, rows: [{ types: ["qrcode"], h: 52 }] },
  ],
};

const ULTRAWIDE: Record<LayoutPreset, Column[]> = {
  classic: [
    { weight: 0.18, rows: [{ types: ["logo"], h: 22 }, { types: ["title"], h: 40, grow: 1 }, { types: ["message"], h: 28 }] },
    { weight: 0.29, center: true, rows: [{ types: ["total"], h: 40 }, { types: ["goal"], h: 13 }] },
    { weight: 0.4, rows: [{ types: ["donations"], h: 100, grow: 1 }] },
    { weight: 0.11, center: true, rows: [{ types: ["qrcode"], h: 56 }] },
  ],
  spotlight: [
    { weight: 0.17, rows: [{ types: ["logo"], h: 22 }, { types: ["title"], h: 36, grow: 1 }, { types: ["message"], h: 30 }] },
    { weight: 0.38, center: true, rows: [{ types: ["total"], h: 52 }, { types: ["goal"], h: 14 }] },
    { weight: 0.32, rows: [{ types: ["donations"], h: 100, grow: 1 }] },
    { weight: 0.11, center: true, rows: [{ types: ["qrcode"], h: 56 }] },
  ],
  donors: [
    { weight: 0.44, rows: [{ types: ["donations"], h: 100, grow: 1 }] },
    { weight: 0.3, center: true, rows: [{ types: ["logo"], h: 18 }, { types: ["title"], h: 20 }, { types: ["total"], h: 30 }, { types: ["goal"], h: 12 }] },
    { weight: 0.14, center: true, rows: [{ types: ["message"], h: 50 }] },
    { weight: 0.11, center: true, rows: [{ types: ["qrcode"], h: 56 }] },
  ],
  minimal: [
    { weight: 0.2, center: true, rows: [{ types: ["logo"], h: 24 }, { types: ["title"], h: 30 }, { types: ["message"], h: 30 }] },
    { weight: 0.42, center: true, rows: [{ types: ["total"], h: 55 }, { types: ["goal"], h: 15 }] },
    { weight: 0.25, rows: [{ types: ["donations"], h: 100, grow: 1 }] },
    { weight: 0.11, center: true, rows: [{ types: ["qrcode"], h: 56 }] },
  ],
};

/** Blocs « compacts » : largeur déduite de la hauteur quand ils partagent une ligne (rapport largeur / hauteur). */
const COMPACT: Partial<Record<BlockType, number>> = { logo: 1.1, qrcode: 0.8 };

type PxRect = { x: number; y: number; w: number; h: number; align?: ShowBlock["align"] };

/**
 * Compose la mise en page d'un format portrait ou large à partir des blocs (visibilité, taille du
 * texte et ordre des calques conservés). Les blocs masqués gardent leur position et restent masqués ;
 * `hideEmptyMessage` libère la place du bloc « Texte » quand aucun message n'est saisi.
 * Les types de blocs inconnus des gabarits (ajoutés plus tard) sont empilés sous la liste des dons.
 */
function composeBlocks(blocks: ShowBlock[], preset: LayoutPreset, format: FormatId, rtl: boolean, hideEmptyMessage: boolean): ShowBlock[] {
  const { width: W, height: H } = getFormat(format);
  const shown = (type: BlockType) => blocks.some((b) => b.type === type && b.visible) && !(hideEmptyMessage && type === "message");
  const family = FAMILY[format];
  const placed = new Map<BlockType, PxRect>();

  if (family === "portrait") {
    const rows = withExtras(PORTRAIT[preset], blocks);
    const mx = W * 0.05;
    const my = H * 0.03;
    stack(rows, { x: mx, y: my, w: W - mx * 2, h: H - my * 2 }, H * 0.014, false, shown, placed);
  } else {
    const spec = (family === "ultrawide" ? ULTRAWIDE : WIDE)[preset];
    const extras = extraTypes(spec.flatMap((c) => c.rows), blocks);
    const columns = spec
      .map((col) => {
        const hasDonations = col.rows.some((r) => r.types.includes("donations"));
        return hasDonations && extras.length ? { ...col, rows: [...col.rows, ...extras.map((t) => ({ types: [t], h: 18, grow: 0.3 }))] } : col;
      })
      .filter((col) => col.rows.some((r) => r.types.some(shown)));
    const mx = H * 0.045;
    const my = H * 0.05;
    const gap = H * 0.04;
    const avail = W - mx * 2 - gap * Math.max(0, columns.length - 1);
    const total = columns.reduce((s, c) => s + c.weight, 0) || 1;
    let x = mx;
    for (const col of columns) {
      const w = (avail * col.weight) / total;
      stack(col.rows, { x, y: my, w, h: H - my * 2 }, H * 0.03, Boolean(col.center), shown, placed);
      x += w + gap;
    }
  }

  return blocks.map((block) => {
    const r = placed.get(block.type);
    if (!r) return block.visible && !shown(block.type) ? { ...block, visible: false } : block;
    const px = { x: (r.x / W) * 100, y: (r.y / H) * 100, w: (r.w / W) * 100, h: (r.h / H) * 100 };
    return clampBlock({ ...block, ...px, x: rtl ? 100 - px.x - px.w : px.x, align: r.align ?? defaultAlign(block.type) });
  });
}

function extraTypes(rows: Row[], blocks: ShowBlock[]): BlockType[] {
  const known = new Set(rows.flatMap((r) => r.types));
  return blocks.map((b) => b.type).filter((t) => !known.has(t));
}

function withExtras(rows: Row[], blocks: ShowBlock[]): Row[] {
  const extras = extraTypes(rows, blocks);
  if (extras.length === 0) return rows;
  const at = rows.findIndex((r) => r.types.includes("donations")) + 1 || rows.length;
  return [...rows.slice(0, at), ...extras.map((t) => ({ types: [t], h: 10, grow: 0.2 })), ...rows.slice(at)];
}

/** Empile les lignes visibles dans une zone (px) ; l'espace libre est réparti selon `grow` (ou laissé autour du groupe). */
function stack(rows: Row[], area: PxRect, gap: number, center: boolean, shown: (t: BlockType) => boolean, out: Map<BlockType, PxRect>) {
  const visible = rows.map((r) => ({ ...r, types: r.types.filter(shown) })).filter((r) => r.types.length > 0);
  if (visible.length === 0) return;
  const avail = area.h - gap * (visible.length - 1);
  let heights = visible.map((r) => (r.h / 100) * area.h);
  const base = heights.reduce((s, h) => s + h, 0);
  if (base > avail) {
    heights = heights.map((h) => (h * avail) / base);
  } else if (!center) {
    const grows = visible.map((r) => r.grow ?? 0);
    const sum = grows.reduce((s, g) => s + g, 0);
    const extra = avail - base;
    heights = heights.map((h, i) => h + (sum > 0 ? (extra * grows[i]) / sum : (extra * h) / base));
  }
  const used = heights.reduce((s, h) => s + h, 0) + gap * (visible.length - 1);
  // Groupe centré légèrement remonté : les ornements des décors vivent en bas de l'écran.
  let y = area.y + (center ? (area.h - used) * 0.3 : 0);
  visible.forEach((row, i) => {
    placeRow(row, { x: area.x, y, w: area.w, h: heights[i] }, gap, out);
    y += heights[i] + gap;
  });
}

/** Blocs d'une ligne côte à côte : les blocs compacts (logo, QR code) prennent la largeur de leur contenu. */
function placeRow(row: Row, area: PxRect, gap: number, out: Map<BlockType, PxRect>) {
  if (row.types.length === 1) {
    const type = row.types[0];
    const ratio = type === "qrcode" ? COMPACT.qrcode : undefined;
    const w = ratio ? Math.min(area.w, Math.max(area.h * ratio, area.w * 0.3)) : area.w;
    out.set(type, { x: area.x + (area.w - w) / 2, y: area.y, w, h: area.h, align: row.align });
    return;
  }
  const inner = area.w - gap * (row.types.length - 1);
  const fixed = row.types.map((t) => {
    const ratio = COMPACT[t];
    return ratio ? Math.min(area.h * ratio, inner * 0.4) : 0;
  });
  const flexible = row.types.filter((t) => !COMPACT[t]).length;
  const rest = inner - fixed.reduce((s, w) => s + w, 0);
  let x = area.x;
  row.types.forEach((type, i) => {
    const w = fixed[i] || (flexible > 0 ? rest / flexible : inner / row.types.length);
    out.set(type, { x, y: area.y, w, h: area.h, align: row.align ?? (type === "title" || type === "message" ? "start" : undefined) });
    x += w + gap;
  });
}

/**
 * Mise en page dérivée du 16:9 pour un format :
 *  - 16:9, 16:10, 4:3 : la mise en page principale, reprise en % ;
 *  - 9:16, 21:9, 32:9 : composition dédiée à partir de la mise en page proposée qui correspond
 *    au 16:9 (ou, pour une disposition libre, de la mise en page automatique), avec la même
 *    visibilité, la même taille de texte et le même ordre de calques. Un bloc « Texte » vide
 *    n'occupe pas de place.
 */
export function deriveFormatBlocks(config: ShowConfig, format: FormatId, rtl: boolean): ShowBlock[] {
  if (FAMILY[format] === "proportional") return config.blocks;
  const preset = matchPreset(config.blocks, rtl) ?? pickPreset(config);
  return composeBlocks(config.blocks, preset, format, rtl, !config.texts.message.trim());
}

/** Mise en page affichée pour un format : personnalisée si elle existe, sinon dérivée du 16:9. */
export function formatBlocks(config: ShowConfig, format: FormatId, rtl: boolean): ShowBlock[] {
  if (format === "16:9") return config.blocks;
  return customFormatBlocks(config, format) ?? deriveFormatBlocks(config, format, rtl);
}
