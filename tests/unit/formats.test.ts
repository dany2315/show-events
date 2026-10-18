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
  type ShowBlock,
  type ShowConfig,
  THEME_IDS,
} from "@/lib/show/config";
import { ALT_FORMAT_IDS, closestFormat, FORMAT_IDS, FORMAT_LIST, getFormat, parseFormatParam, SCREEN_FORMATS } from "@/lib/show/formats";
import { applyPreset, autoLayout, deriveFormatBlocks, findOverlaps, fixOverlaps, formatBlocks, LAYOUT_PRESETS } from "@/lib/show/smart-layout";
import { backgroundScene } from "@/lib/show/themes";
import { ShowStage } from "@/components/show/stage";
import { demoDonations, demoEvent } from "@/lib/show/demo";
import { EMPTY_CONTROL } from "@/lib/live/types";

const allVisible = (message = "Merci pour votre générosité") => {
  const c = defaultShowConfig();
  c.texts.message = message;
  c.blocks = c.blocks.map((b) => ({ ...b, visible: true }));
  return c;
};

function expectInBounds(blocks: ShowBlock[]) {
  for (const b of blocks) {
    expect(b.x, b.type).toBeGreaterThanOrEqual(0);
    expect(b.y, b.type).toBeGreaterThanOrEqual(0);
    expect(b.x + b.w, b.type).toBeLessThanOrEqual(100.01);
    expect(b.y + b.h, b.type).toBeLessThanOrEqual(100.01);
  }
}

describe("formats d'écran", () => {
  it("définit les 6 formats avec leurs surfaces", () => {
    expect([...FORMAT_IDS]).toEqual(["16:9", "16:10", "4:3", "21:9", "32:9", "9:16"]);
    expect(stageSize("16:9")).toEqual({ width: 1920, height: 1080 });
    expect(stageSize("16:10")).toEqual({ width: 1920, height: 1200 });
    expect(stageSize("4:3")).toEqual({ width: 1440, height: 1080 });
    expect(stageSize("21:9")).toEqual({ width: 2520, height: 1080 });
    expect(stageSize("32:9")).toEqual({ width: 3840, height: 1080 });
    expect(stageSize("9:16")).toEqual({ width: 1080, height: 1920 });
    for (const f of FORMAT_LIST) {
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
    expect(closestFormat(1080, 1920)).toBe("9:16");
    expect(closestFormat(390, 844)).toBe("9:16");
    // Tablette en portrait : 9:16 est plus proche que 4:3 couché.
    expect(closestFormat(768, 1024)).toBe("9:16");
    expect(closestFormat(0, 0)).toBe("16:9");
    expect(closestFormat(Number.NaN, 1080)).toBe("16:9");
  });

  it("lit le paramètre d'URL ?format=", () => {
    expect(parseFormatParam("9:16")).toBe("9:16");
    expect(parseFormatParam("9x16")).toBe("9:16");
    expect(parseFormatParam("9-16")).toBe("9:16");
    expect(parseFormatParam("portrait")).toBe("9:16");
    expect(parseFormatParam("Portrait")).toBe("9:16");
    expect(parseFormatParam("21:9")).toBe("21:9");
    expect(parseFormatParam("ultrawide")).toBe("21:9");
    expect(parseFormatParam(["32:9", "4:3"])).toBe("32:9");
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
  it.each(FORMAT_IDS)("format %s : chaque mise en page proposée tient sans chevauchement ni débordement", (format) => {
    for (const rtl of [false, true]) {
      for (const preset of LAYOUT_PRESETS) {
        // Dans le format lui-même (bouton du Studio)…
        const applied = applyPreset({ ...allVisible(), blocks: formatBlocks(allVisible(), format, rtl) }, preset, rtl, format);
        expect(applied.blocks).toHaveLength(BLOCK_TYPES.length);
        expect(findOverlaps(applied.blocks), `${format} ${preset} ${rtl}`).toEqual([]);
        expectInBounds(applied.blocks);
        // … et dérivée depuis la même mise en page 16:9.
        const main = applyPreset(allVisible(), preset, rtl);
        const derived = deriveFormatBlocks(main, format, rtl);
        expect(derived.map((b) => b.type)).toEqual(main.blocks.map((b) => b.type));
        expect(findOverlaps(derived), `dérivée ${format} ${preset} ${rtl}`).toEqual([]);
        expectInBounds(derived);
      }
    }
  });

  it.each(ALT_FORMAT_IDS)("format %s : dérivation sans chevauchement quand des blocs sont masqués", (format) => {
    const combos: Array<Array<(typeof BLOCK_TYPES)[number]>> = [["message"], ["title", "message"], ["donations"], ["qrcode"], ["logo", "title", "message"], ["goal", "qrcode"]];
    for (const hidden of combos) {
      const c = allVisible();
      c.blocks = c.blocks.map((b) => (hidden.includes(b.type) ? { ...b, visible: false } : b));
      for (const rtl of [false, true]) {
        const derived = deriveFormatBlocks(c, format, rtl);
        expect(findOverlaps(derived), `${format} sans ${hidden.join("+")}`).toEqual([]);
        expectInBounds(derived);
        for (const type of hidden) expect(derived.find((b) => b.type === type)?.visible).toBe(false);
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

  it("portrait 9:16 : empilement vertical lisible (logo, titre, total, objectif, dons, QR code)", () => {
    const blocks = deriveFormatBlocks(allVisible(), "9:16", false);
    const by = (t: string) => blocks.find((b) => b.type === t)!;
    const order = ["logo", "title", "total", "goal", "donations", "qrcode"].map((t) => by(t).y);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // Les blocs principaux occupent presque toute la largeur ; le QR code est en bas.
    expect(by("total").w).toBeGreaterThan(80);
    expect(by("donations").w).toBeGreaterThan(80);
    expect(by("qrcode").y + by("qrcode").h).toBeGreaterThan(90);
    expect(by("donations").h).toBeGreaterThan(by("total").h);
  });

  it("21:9 et 32:9 : répartition horizontale (le total et la liste des dons côte à côte)", () => {
    for (const format of ["21:9", "32:9"] as const) {
      const blocks = deriveFormatBlocks(allVisible(), format, false);
      const by = (t: string) => blocks.find((b) => b.type === t)!;
      expect(by("logo").x).toBeLessThan(by("total").x);
      expect(by("qrcode").x).toBeGreaterThan(by("total").x + by("total").w - 0.01);
      expect(by("donations").h).toBeGreaterThan(40);
    }
    const ultra = deriveFormatBlocks(allVisible(), "32:9", false);
    const by = (t: string) => ultra.find((b) => b.type === t)!;
    // En 32:9, la liste des dons a sa propre colonne, à droite du total.
    expect(by("donations").x).toBeGreaterThanOrEqual(by("total").x + by("total").w);
  });

  it("retourne les mises en page dérivées pour l'hébreu (lecture de droite à gauche)", () => {
    for (const format of ["9:16", "21:9", "32:9"] as const) {
      const ltr = deriveFormatBlocks(allVisible(), format, false);
      const rtl = deriveFormatBlocks(allVisible(), format, true);
      for (const b of ltr) {
        const mirrored = rtl.find((r) => r.type === b.type)!;
        expect(mirrored.x, `${format} ${b.type}`).toBeCloseTo(100 - b.x - b.w, 1);
        expect(mirrored.y).toBe(b.y);
      }
    }
  });

  it("un bloc « Texte » vide ne prend pas de place dans les formats dérivés", () => {
    const c = defaultShowConfig();
    const empty = deriveFormatBlocks(c, "9:16", false);
    expect(empty.find((b) => b.type === "message")?.visible).toBe(false);
    c.texts.message = "Merci !";
    expect(deriveFormatBlocks(c, "9:16", false).find((b) => b.type === "message")?.visible).toBe(true);
    // Le 16:9 ne change pas.
    expect(c.blocks.find((b) => b.type === "message")?.visible).toBe(true);
  });

  it("suit la mise en page 16:9 choisie (Donateurs à l'honneur : liste des dons à gauche)", () => {
    const donors = applyPreset(allVisible(), "donors", false);
    const derived = deriveFormatBlocks(donors, "21:9", false);
    const list = derived.find((b) => b.type === "donations")!;
    expect(list.x).toBeLessThan(10);
    expect(list.h).toBeGreaterThan(80);
  });

  it("conserve la taille du texte, la visibilité et l'ordre des calques", () => {
    const c = allVisible();
    c.blocks = [...c.blocks].reverse().map((b) => (b.type === "total" ? { ...b, fontScale: 1.4 } : b));
    const derived = deriveFormatBlocks(c, "9:16", false);
    expect(derived.map((b) => b.type)).toEqual(c.blocks.map((b) => b.type));
    expect(derived.find((b) => b.type === "total")?.fontScale).toBe(1.4);
  });

  it("une mise en page personnalisée remplace la mise en page dérivée, puis se réinitialise", () => {
    const c = allVisible();
    const derived = formatBlocks(c, "9:16", false);
    const custom = derived.map((b) => (b.type === "total" ? { ...b, y: b.y + 1 } : b));
    const withCustom = withFormatBlocks(c, "9:16", custom);
    expect(customFormatBlocks(withCustom, "9:16")).toBe(custom);
    expect(formatBlocks(withCustom, "9:16", false)).toBe(custom);
    // Les autres formats restent dérivés ; le 16:9 est inchangé.
    expect(customFormatBlocks(withCustom, "21:9")).toBeNull();
    expect(withCustom.blocks).toBe(c.blocks);
    // Le 16:9 s'enregistre dans le champ principal.
    expect(withFormatBlocks(c, "16:9", custom).blocks).toBe(custom);
    const reset = withoutFormatBlocks(withCustom, "9:16");
    expect(reset).not.toHaveProperty("layouts");
    expect(formatBlocks(reset, "9:16", false)).toEqual(derived);
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

  it("normalise les mises en page par format (formats inconnus, blocs invalides, blocs manquants)", () => {
    const base = defaultShowConfig();
    const portrait = deriveFormatBlocks({ ...base, texts: { ...base.texts, message: "Merci" } }, "9:16", false);
    const config = normalizeShowConfig({
      ...base,
      layouts: {
        "9:16": [...portrait.filter((b) => b.type !== "qrcode"), { type: "inconnu" }, { ...portrait[0], x: 300 }],
        "21:9": "pas une liste",
        "5:4": portrait,
        "16:9": portrait,
        "32:9": [],
      },
    });
    expect(showConfigSchema.safeParse(config).success).toBe(true);
    expect(Object.keys(config.layouts ?? {})).toEqual(["9:16"]);
    const blocks = config.layouts!["9:16"]!;
    expect(blocks).toHaveLength(BLOCK_TYPES.length);
    // Le QR code manquant reprend la position du 16:9, masqué.
    const qr = blocks.find((b) => b.type === "qrcode")!;
    expect(qr.visible).toBe(false);
    expect(qr.x).toBe(base.blocks.find((b) => b.type === "qrcode")!.x);
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

  it("la scène hébreu est rendue de droite à gauche avec la mise en page miroir", () => {
    const he = demoEvent("he");
    const html = renderToStaticMarkup(
      createElement(ShowStage, { config: allVisible(), event: he, total: 1000, donations: demoDonations("he"), control, formUrl: null, format: "9:16", lowPower: true }),
    );
    expect(html).toContain('dir="rtl"');
    const derived = deriveFormatBlocks(allVisible(), "9:16", true);
    const title = derived.find((b) => b.type === "title")!;
    expect(html).toContain(`left:${(title.x / 100) * 1080}px`);
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
