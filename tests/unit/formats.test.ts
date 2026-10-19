import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  BLOCK_TYPES,
  blockToPixels,
  customFormatBlocks,
  defaultShowConfig,
  fitScale,
  normalizeShowConfig,
  pixelsToBlock,
  showConfigSchema,
  stageSize,
  withFormatBlocks,
  withoutFormatBlocks,
  type BlockType,
  type ShowBlock,
  type ShowConfig,
  THEME_IDS,
} from "@/lib/show/config";
import { ALT_FORMAT_IDS, closestFormat, FORMAT_IDS, FORMAT_LIST, getFormat, parseFormatParam, SCREEN_FORMATS } from "@/lib/show/formats";
import { applyPreset, autoLayout, deriveFormatBlocks, findOverlaps, fixOverlaps, formatBlocks, LAYOUT_PRESETS } from "@/lib/show/smart-layout";
import { hideCategoriesBlock, revealCategoriesBlock } from "@/lib/show/categories-layout";
import { backgroundScene } from "@/lib/show/themes";
import { ShowStage } from "@/components/show/stage";
import { demoDonations, demoEvent } from "@/lib/show/demo";
import { EMPTY_CONTROL } from "@/lib/live/types";

/** Tous les blocs affichés ; le bloc « Catégories » seulement si l'événement a des catégories. */
const allVisible = ({ message = "Merci pour votre générosité", categories = false } = {}) => {
  const c = defaultShowConfig();
  c.texts.message = message;
  c.blocks = c.blocks.map((b) => ({ ...b, visible: b.type === "categories" ? categories : true }));
  return c;
};

const by = (blocks: ShowBlock[], type: BlockType) => blocks.find((b) => b.type === type)!;

function expectInBounds(blocks: ShowBlock[]) {
  for (const b of blocks) {
    expect(b.x, b.type).toBeGreaterThanOrEqual(0);
    expect(b.y, b.type).toBeGreaterThanOrEqual(0);
    expect(b.x + b.w, b.type).toBeLessThanOrEqual(100.01);
    expect(b.y + b.h, b.type).toBeLessThanOrEqual(100.01);
  }
}

describe("formats d'écran", () => {
  it("définit les 5 formats couchés avec leurs surfaces (aucun format portrait)", () => {
    expect([...FORMAT_IDS]).toEqual(["16:9", "16:10", "4:3", "21:9", "32:9"]);
    expect(stageSize("16:9")).toEqual({ width: 1920, height: 1080 });
    expect(stageSize("16:10")).toEqual({ width: 1920, height: 1200 });
    expect(stageSize("4:3")).toEqual({ width: 1440, height: 1080 });
    expect(stageSize("21:9")).toEqual({ width: 2520, height: 1080 });
    expect(stageSize("32:9")).toEqual({ width: 3840, height: 1080 });
    for (const f of FORMAT_LIST) {
      expect(f.width).toBeGreaterThan(f.height);
      expect(f.label.fr.startsWith(f.id)).toBe(true);
      expect(f.label.he.startsWith(f.id)).toBe(true);
    }
    expect(getFormat(null).id).toBe("16:9");
  });

  it("choisit le format le plus proche de la fenêtre (rapports comparés en logarithme)", () => {
    expect(closestFormat(1920, 1080)).toBe("16:9");
    expect(closestFormat(3840, 2160)).toBe("16:9");
    expect(closestFormat(1366, 768)).toBe("16:9");
    expect(closestFormat(1440, 900)).toBe("16:10");
    expect(closestFormat(1920, 1200)).toBe("16:10");
    expect(closestFormat(1024, 768)).toBe("4:3");
    expect(closestFormat(1280, 1024)).toBe("4:3");
    expect(closestFormat(3440, 1440)).toBe("21:9");
    expect(closestFormat(2560, 1080)).toBe("21:9");
    expect(closestFormat(5120, 1440)).toBe("32:9");
    expect(closestFormat(7680, 1080)).toBe("32:9");
    // Fenêtre en portrait : le format couché le plus proche (4:3), avec des bandes noires.
    expect(closestFormat(1080, 1920)).toBe("4:3");
    expect(closestFormat(390, 844)).toBe("4:3");
    expect(closestFormat(768, 1024)).toBe("4:3");
    expect(closestFormat(0, 0)).toBe("16:9");
    expect(closestFormat(Number.NaN, 1080)).toBe("16:9");
  });

  it("lit le paramètre d'URL ?format= (le portrait n'est plus proposé)", () => {
    expect(parseFormatParam("21:9")).toBe("21:9");
    expect(parseFormatParam("21x9")).toBe("21:9");
    expect(parseFormatParam("21-9")).toBe("21:9");
    expect(parseFormatParam("ultrawide")).toBe("21:9");
    expect(parseFormatParam("Projecteur")).toBe("4:3");
    expect(parseFormatParam(["32:9", "4:3"])).toBe("32:9");
    expect(parseFormatParam("9:16")).toBeNull();
    expect(parseFormatParam("portrait")).toBeNull();
    expect(parseFormatParam("5:4")).toBeNull();
    expect(parseFormatParam("")).toBeNull();
    expect(parseFormatParam(undefined)).toBeNull();
  });

  it("convertit % ↔ pixels sur la surface de chaque format", () => {
    for (const id of FORMAT_IDS) {
      const stage = stageSize(id);
      const px = blockToPixels({ x: 10, y: 20, w: 30, h: 40 }, stage);
      expect(px).toEqual({ left: stage.width * 0.1, top: stage.height * 0.2, width: stage.width * 0.3, height: stage.height * 0.4 });
      const back = pixelsToBlock(px, stage);
      expect(back.x).toBeCloseTo(10);
      expect(back.h).toBeCloseTo(40);
      expect(fitScale(stage.width / 2, stage.height / 2, stage)).toBeCloseTo(0.5);
    }
    // Sans surface : référence 1920 × 1080 (rétrocompatible).
    expect(blockToPixels({ x: 50, y: 50, w: 10, h: 10 }).left).toBe(960);
  });
});

describe("mises en page par format", () => {
  it.each(FORMAT_IDS)("format %s : chaque mise en page proposée tient sans chevauchement ni débordement, avec ou sans catégories", (format) => {
    for (const categories of [false, true]) {
      for (const rtl of [false, true]) {
        for (const preset of LAYOUT_PRESETS) {
          const base = allVisible({ categories });
          const label = `${format} ${preset} rtl=${rtl} catégories=${categories}`;
          // Dans le format lui-même (bouton du Studio)…
          const applied = applyPreset({ ...base, blocks: formatBlocks(base, format, rtl) }, preset, rtl, format);
          expect(applied.blocks).toHaveLength(BLOCK_TYPES.length);
          expect(findOverlaps(applied.blocks), label).toEqual([]);
          expectInBounds(applied.blocks);
          expect(by(applied.blocks, "categories").visible).toBe(categories);
          // … et dérivée depuis la même mise en page 16:9.
          const main = applyPreset(base, preset, rtl);
          const derived = deriveFormatBlocks(main, format, rtl);
          expect(derived.map((b) => b.type)).toEqual(main.blocks.map((b) => b.type));
          expect(findOverlaps(derived), `dérivée ${label}`).toEqual([]);
          expectInBounds(derived);
          expect(by(derived, "categories").visible).toBe(categories);
        }
      }
    }
  });

  it.each(ALT_FORMAT_IDS)("format %s : dérivation sans chevauchement quand des blocs sont masqués", (format) => {
    const combos: BlockType[][] = [["message"], ["title", "message"], ["donations"], ["qrcode"], ["logo", "title", "message"], ["goal", "qrcode"]];
    for (const hidden of combos) {
      for (const categories of [false, true]) {
        const c = applyPreset(allVisible({ categories }), "classic", false);
        c.blocks = c.blocks.map((b) => (hidden.includes(b.type) ? { ...b, visible: false } : b));
        for (const rtl of [false, true]) {
          const derived = deriveFormatBlocks(c, format, rtl);
          expect(findOverlaps(derived), `${format} sans ${hidden.join("+")}`).toEqual([]);
          expectInBounds(derived);
          for (const type of hidden) expect(by(derived, type).visible).toBe(false);
        }
      }
    }
  });

  it("16:10 et 4:3 reprennent la mise en page 16:9 en %, y compris une disposition libre", () => {
    const c = defaultShowConfig();
    c.blocks = c.blocks.map((b) => (b.type === "total" ? { ...b, x: 5, y: 60, w: 40, h: 30 } : b));
    expect(deriveFormatBlocks(c, "16:10", false)).toBe(c.blocks);
    expect(deriveFormatBlocks(c, "4:3", false)).toBe(c.blocks);
    expect(formatBlocks(c, "16:9", false)).toBe(c.blocks);
  });

  it("21:9 et 32:9 : répartition horizontale (le total et la liste des dons côte à côte)", () => {
    for (const format of ["21:9", "32:9"] as const) {
      const blocks = deriveFormatBlocks(allVisible(), format, false);
      expect(by(blocks, "logo").x).toBeLessThan(by(blocks, "total").x);
      expect(by(blocks, "qrcode").x).toBeGreaterThan(by(blocks, "total").x + by(blocks, "total").w - 0.01);
      expect(by(blocks, "donations").h).toBeGreaterThan(40);
    }
    const ultra = deriveFormatBlocks(allVisible(), "32:9", false);
    // En 32:9, la liste des dons a sa propre colonne, à droite du total.
    expect(by(ultra, "donations").x).toBeGreaterThanOrEqual(by(ultra, "total").x + by(ultra, "total").w);
  });

  it("21:9 et 32:9 : le bandeau des catégories surmonte la liste des dons, dans sa colonne", () => {
    for (const format of ["21:9", "32:9"] as const) {
      for (const rtl of [false, true]) {
        for (const preset of LAYOUT_PRESETS) {
          const main = applyPreset(allVisible({ categories: true }), preset, rtl);
          const blocks = deriveFormatBlocks(main, format, rtl);
          const cat = by(blocks, "categories");
          const list = by(blocks, "donations");
          expect(cat.visible).toBe(true);
          expect(cat.x).toBeCloseTo(list.x, 1);
          expect(cat.w).toBeCloseTo(list.w, 1);
          expect(cat.y + cat.h).toBeLessThanOrEqual(list.y);
          expect(list.y - (cat.y + cat.h)).toBeLessThan(5);
          // Bandeau : catégories côte à côte (bloc nettement plus large que haut à l'écran).
          const { width, height } = SCREEN_FORMATS[format];
          expect((cat.w * width) / (cat.h * height)).toBeGreaterThan(2.4);
        }
      }
      // Sans catégorie : le bloc reste masqué et la liste des dons reprend la place.
      const without = deriveFormatBlocks(allVisible(), format, false);
      const withCats = deriveFormatBlocks(applyPreset(allVisible({ categories: true }), "classic", false), format, false);
      expect(by(without, "categories").visible).toBe(false);
      expect(by(without, "donations").h).toBeGreaterThan(by(withCats, "donations").h);
    }
  });

  it("16:10 et 4:3 : les catégories restent taillées dans la liste des dons, comme en 16:9", () => {
    const main = applyPreset(allVisible({ categories: true }), "classic", false);
    for (const format of ["16:10", "4:3"] as const) {
      const blocks = deriveFormatBlocks(main, format, false);
      expect(by(blocks, "categories")).toEqual(by(main.blocks, "categories"));
      expect(findOverlaps(blocks)).toEqual([]);
    }
  });

  it("retourne les mises en page dérivées pour l'hébreu (lecture de droite à gauche)", () => {
    for (const format of ["21:9", "32:9"] as const) {
      const ltr = deriveFormatBlocks(applyPreset(allVisible({ categories: true }), "classic", false), format, false);
      const rtl = deriveFormatBlocks(applyPreset(allVisible({ categories: true }), "classic", true), format, true);
      for (const b of ltr) {
        const mirrored = by(rtl, b.type);
        expect(mirrored.x, `${format} ${b.type}`).toBeCloseTo(100 - b.x - b.w, 1);
        expect(mirrored.y).toBe(b.y);
      }
    }
  });

  it("un bloc « Texte » vide ne prend pas de place dans les formats dérivés", () => {
    const c = defaultShowConfig();
    expect(by(deriveFormatBlocks(c, "21:9", false), "message").visible).toBe(false);
    c.texts.message = "Merci !";
    expect(by(deriveFormatBlocks(c, "21:9", false), "message").visible).toBe(true);
    // Le 16:9 ne change pas.
    expect(by(c.blocks, "message").visible).toBe(true);
  });

  it("suit la mise en page 16:9 choisie (Donateurs à l'honneur : liste des dons à gauche)", () => {
    for (const categories of [false, true]) {
      const donors = applyPreset(allVisible({ categories }), "donors", false);
      const list = by(deriveFormatBlocks(donors, "21:9", false), "donations");
      expect(list.x).toBeLessThan(10);
      expect(list.h).toBeGreaterThan(categories ? 70 : 80);
    }
  });

  it("conserve la taille du texte, la visibilité et l'ordre des calques", () => {
    const c = allVisible();
    c.blocks = [...c.blocks].reverse().map((b) => (b.type === "total" ? { ...b, fontScale: 1.4 } : b));
    const derived = deriveFormatBlocks(c, "32:9", false);
    expect(derived.map((b) => b.type)).toEqual(c.blocks.map((b) => b.type));
    expect(by(derived, "total").fontScale).toBe(1.4);
  });

  it("une mise en page personnalisée remplace la mise en page dérivée, puis se réinitialise", () => {
    const c = allVisible();
    const derived = formatBlocks(c, "21:9", false);
    const custom = derived.map((b) => (b.type === "total" ? { ...b, y: b.y + 1 } : b));
    const withCustom = withFormatBlocks(c, "21:9", custom);
    expect(customFormatBlocks(withCustom, "21:9")).toBe(custom);
    expect(formatBlocks(withCustom, "21:9", false)).toBe(custom);
    // Les autres formats restent dérivés ; le 16:9 est inchangé.
    expect(customFormatBlocks(withCustom, "32:9")).toBeNull();
    expect(withCustom.blocks).toBe(c.blocks);
    // Le 16:9 s'enregistre dans le champ principal.
    expect(withFormatBlocks(c, "16:9", custom).blocks).toBe(custom);
    const reset = withoutFormatBlocks(withCustom, "21:9");
    expect(reset).not.toHaveProperty("layouts");
    expect(formatBlocks(reset, "21:9", false)).toEqual(derived);
  });

  it("les catégories apparaissent et disparaissent aussi dans les mises en page personnalisées", () => {
    const base = defaultShowConfig();
    base.texts.message = "Merci";
    const custom = withFormatBlocks(withFormatBlocks(base, "21:9", deriveFormatBlocks(base, "21:9", false)), "4:3", base.blocks);
    const revealed = revealCategoriesBlock(custom, false);
    for (const blocks of [revealed.blocks, revealed.layouts!["21:9"]!, revealed.layouts!["4:3"]!]) {
      expect(by(blocks, "categories").visible).toBe(true);
      expect(findOverlaps(blocks)).toEqual([]);
    }
    const hidden = hideCategoriesBlock(revealed);
    for (const [blocks, before] of [
      [hidden.blocks, custom.blocks],
      [hidden.layouts!["21:9"]!, custom.layouts!["21:9"]!],
      [hidden.layouts!["4:3"]!, custom.layouts!["4:3"]!],
    ] as const) {
      expect(by(blocks, "categories").visible).toBe(false);
      // La liste des dons reprend sa place d'origine.
      expect(by(blocks, "donations")).toEqual(by(before, "donations"));
    }
    // Rien à faire : configuration inchangée.
    expect(hideCategoriesBlock(custom)).toBe(custom);
  });

  it("disposition automatique et correction des chevauchements dans chaque format", () => {
    for (const format of FORMAT_IDS) {
      const view: ShowConfig = { ...allVisible(), blocks: formatBlocks(allVisible(), format, false) };
      const auto = autoLayout(view, false, format);
      expect(auto.preset).toBe("classic");
      expect(findOverlaps(auto.config.blocks)).toEqual([]);
      // Le nombre et les colonnes de la liste des dons ne changent qu'en 16:9 (réglage commun).
      const donors = applyPreset({ ...view, donations: { count: 5, columns: 2 } }, "donors", false, format);
      expect(donors.donations).toEqual(format === "16:9" ? { count: 12, columns: 1 } : { count: 5, columns: 2 });
      const messy = { ...view, blocks: view.blocks.map((b, i) => ({ ...b, x: 10 + i, y: 10 + i, w: 20, h: 15 })) };
      expect(findOverlaps(fixOverlaps(messy).blocks)).toEqual([]);
    }
  });
});

describe("configuration : rétrocompatibilité des formats", () => {
  it("une ancienne configuration sans `layouts` reste valide et sans mise en page personnalisée", () => {
    const legacy = { ...defaultShowConfig("velours") } as Record<string, unknown>;
    delete legacy.layouts;
    const config = normalizeShowConfig(legacy);
    expect(showConfigSchema.safeParse(config).success).toBe(true);
    expect(config).not.toHaveProperty("layouts");
    for (const format of ALT_FORMAT_IDS) expect(customFormatBlocks(config, format)).toBeNull();
  });

  it("ignore sans erreur une mise en page 9:16 déjà enregistrée (format retiré)", () => {
    const base = defaultShowConfig();
    const config = normalizeShowConfig({ ...base, layouts: { "9:16": base.blocks.map((b) => ({ ...b, y: 1 })) } });
    expect(showConfigSchema.safeParse(config).success).toBe(true);
    expect(config).not.toHaveProperty("layouts");
    expect(config.blocks).toEqual(base.blocks);
    // Avec un autre format personnalisé, seul celui-ci est conservé.
    const both = normalizeShowConfig({ ...base, layouts: { "9:16": base.blocks, "21:9": base.blocks } });
    expect(Object.keys(both.layouts ?? {})).toEqual(["21:9"]);
  });

  it("normalise les mises en page par format (formats inconnus, blocs invalides, blocs manquants)", () => {
    const base = defaultShowConfig();
    const wide = deriveFormatBlocks({ ...base, texts: { ...base.texts, message: "Merci" } }, "21:9", false);
    const config = normalizeShowConfig({
      ...base,
      layouts: {
        "21:9": [...wide.filter((b) => b.type !== "qrcode"), { type: "inconnu" }, { ...wide[0], x: 300 }],
        "4:3": "pas une liste",
        "5:4": wide,
        "16:9": wide,
        "32:9": [],
      },
    });
    expect(showConfigSchema.safeParse(config).success).toBe(true);
    expect(Object.keys(config.layouts ?? {})).toEqual(["21:9"]);
    const blocks = config.layouts!["21:9"]!;
    expect(blocks).toHaveLength(BLOCK_TYPES.length);
    // Le QR code manquant reprend la position du 16:9, masqué.
    const qr = by(blocks, "qrcode");
    expect(qr.visible).toBe(false);
    expect(qr.x).toBe(by(base.blocks, "qrcode").x);
    // Le doublon est ignoré, les blocs restent dans la surface.
    expect(blocks.filter((b) => b.type === "logo")).toHaveLength(1);
    expectInBounds(blocks);
    // Aller-retour JSON (base de données) sans perte.
    expect(normalizeShowConfig(JSON.parse(JSON.stringify(config)))).toEqual(config);
  });
});

describe("rendu par format", () => {
  const event = demoEvent("fr");
  const control = EMPTY_CONTROL;

  it.each(FORMAT_IDS)("la scène %s a les dimensions du format", (format) => {
    const html = renderToStaticMarkup(
      createElement(ShowStage, { config: allVisible(), event, total: 1000, donations: demoDonations("fr"), control, formUrl: null, format, lowPower: true }),
    );
    const { width, height } = SCREEN_FORMATS[format];
    expect(html).toContain(`data-format="${format}"`);
    expect(html).toContain(`width:${width}px;height:${height}px`);
  });

  it("affiche les catégories de l'événement dans la scène 32:9", () => {
    const categories = [
      { id: "a", name: "Parrains", color: "#e4b65c", total: 5000, count: 2 },
      { id: "b", name: "Amis", color: "#7fe3ff", total: 1200, count: 3 },
    ];
    const config = applyPreset(allVisible({ categories: true }), "classic", false);
    const html = renderToStaticMarkup(
      createElement(ShowStage, { config, event: { ...event, categories }, total: 6200, donations: demoDonations("fr"), control, formUrl: null, format: "32:9", lowPower: true }),
    );
    expect(html).toContain("data-categories");
    expect(html).toContain("Parrains");
  });

  it("la scène hébreu est rendue de droite à gauche avec la mise en page miroir", () => {
    const he = demoEvent("he");
    const html = renderToStaticMarkup(
      createElement(ShowStage, { config: allVisible(), event: he, total: 1000, donations: demoDonations("he"), control, formUrl: null, format: "21:9", lowPower: true }),
    );
    expect(html).toContain('dir="rtl"');
    const title = by(deriveFormatBlocks(allVisible(), "21:9", true), "title");
    expect(html).toContain(`left:${(title.x / 100) * 2520}px`);
  });

  it("les décors couvrent chaque format avec un dessin à ses dimensions (aucune déformation)", () => {
    for (const theme of THEME_IDS) {
      for (const format of FORMAT_IDS) {
        const { width, height } = SCREEN_FORMATS[format];
        const scene = backgroundScene(theme, { width, height });
        expect(scene.length).toBeGreaterThan(50);
        expect(scene).toContain(encodeURIComponent(`viewBox='0 0 ${width} ${height}'`));
      }
    }
    // Sans dimensions : décor 1920 × 1080 (vignettes, rétrocompatible).
    expect(backgroundScene("gala")).toBe(backgroundScene("gala", { width: 1920, height: 1080 }));
  });
});
