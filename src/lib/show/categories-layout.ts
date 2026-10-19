import { clampBlock, type ShowBlock, type ShowConfig } from "./config";

/**
 * Placement du bloc « Catégories » (totaux par catégorie de donateurs).
 *
 * Le bloc est masqué tant que l'événement n'a pas de catégories. Affiché, il est taillé dans
 * la liste des dons, qui lui cède sa place sans chevauchement :
 *  - liste haute : un bandeau en haut de la liste (les catégories côte à côte) ;
 *  - liste basse : une colonne en fin de ligne (les catégories l'une sous l'autre),
 *    à droite en français, à gauche en hébreu.
 */
const STRIP_HEIGHT = 11;
const GAP = 1.5;

export function carveCategories(blocks: ShowBlock[], rtl: boolean): ShowBlock[] {
  const categories = blocks.find((b) => b.type === "categories");
  const donations = blocks.find((b) => b.type === "donations");
  if (!categories?.visible || !donations?.visible) return blocks;

  let nextCategories: ShowBlock;
  let nextDonations: ShowBlock;
  if (donations.h >= 30) {
    nextCategories = { ...categories, x: donations.x, y: donations.y, w: donations.w, h: STRIP_HEIGHT };
    nextDonations = { ...donations, y: donations.y + STRIP_HEIGHT + GAP, h: donations.h - STRIP_HEIGHT - GAP };
  } else if (donations.w >= 40) {
    const w = Math.round(donations.w * 0.36 * 10) / 10;
    const listW = donations.w - w - GAP;
    nextCategories = { ...categories, x: rtl ? donations.x : donations.x + listW + GAP, y: donations.y, w, h: donations.h };
    nextDonations = { ...donations, x: rtl ? donations.x + w + GAP : donations.x, w: listW };
  } else {
    return blocks;
  }
  const placed = { categories: clampBlock(nextCategories), donations: clampBlock(nextDonations) };
  return blocks.map((b) => (b.type === "categories" ? placed.categories : b.type === "donations" ? placed.donations : b));
}

/**
 * Applique une règle à la mise en page 16:9 et aux mises en page personnalisées des autres formats
 * d'écran (les formats non personnalisés sont dérivés du 16:9 et suivent d'eux-mêmes).
 */
function everyLayout(config: ShowConfig, fn: (blocks: ShowBlock[]) => ShowBlock[]): ShowConfig {
  const blocks = fn(config.blocks);
  if (!config.layouts) return blocks === config.blocks ? config : { ...config, blocks };
  let changed = blocks !== config.blocks;
  const layouts = Object.fromEntries(
    Object.entries(config.layouts).map(([format, list]) => {
      const next = list ? fn(list) : list;
      if (next !== list) changed = true;
      return [format, next];
    }),
  ) as ShowConfig["layouts"];
  return changed ? { ...config, blocks, layouts } : config;
}

/** L'événement vient de recevoir ses premières catégories : le bloc apparaît, taillé dans la liste des dons. */
export function revealCategoriesBlock(config: ShowConfig, rtl: boolean): ShowConfig {
  return everyLayout(config, (list) => {
    const block = list.find((b) => b.type === "categories");
    if (!block || block.visible) return list;
    return carveCategories(
      list.map((b) => (b.type === "categories" ? { ...b, visible: true } : b)),
      rtl,
    );
  });
}

/** Plus aucune catégorie : le bloc est masqué et la liste des dons reprend la place s'il l'occupait. */
export function hideCategoriesBlock(config: ShowConfig): ShowConfig {
  return everyLayout(config, hideIn);
}

function hideIn(blocks: ShowBlock[]): ShowBlock[] {
  const categories = blocks.find((b) => b.type === "categories");
  const donations = blocks.find((b) => b.type === "donations");
  if (!categories?.visible) return blocks;
  const near = (a: number, b: number) => Math.abs(a - b) < 0.6;
  let restored = donations;
  if (donations) {
    if (near(categories.x, donations.x) && near(categories.w, donations.w) && near(categories.y + categories.h + GAP, donations.y)) {
      restored = { ...donations, y: categories.y, h: donations.h + categories.h + GAP };
    } else if (near(categories.y, donations.y) && near(categories.h, donations.h)) {
      if (near(donations.x + donations.w + GAP, categories.x)) restored = { ...donations, w: donations.w + categories.w + GAP };
      else if (near(categories.x + categories.w + GAP, donations.x)) restored = { ...donations, x: categories.x, w: donations.w + categories.w + GAP };
    }
  }
  return blocks.map((b) => (b.type === "categories" ? { ...b, visible: false } : b.type === "donations" && restored ? clampBlock(restored) : b));
}
