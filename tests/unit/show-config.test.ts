import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  BLOCK_TYPES,
  blockToPixels,
  clampBlock,
  defaultShowConfig,
  fitScale,
  normalizeShowConfig,
  pixelsToBlock,
  showConfigSchema,
  THEME_IDS,
} from "@/lib/show/config";
import { BACKGROUND_LIST, BACKGROUNDS, backgroundScene, SHOW_CSS_VARS, themeCssVars } from "@/lib/show/themes";
import { AMBIENT_ELEMENT_COUNT } from "@/components/show/ambient";
import { fitFontSize } from "@/components/show/fit";
import { GoalFigures } from "@/components/show/blocks";
import { dictionaries } from "@/i18n/dictionaries";

describe("configuration du show", () => {
  it("la configuration par défaut est valide et contient les 7 blocs du cahier des charges, plus les catégories", () => {
    const config = defaultShowConfig();
    expect(showConfigSchema.safeParse(config).success).toBe(true);
    expect(BLOCK_TYPES).toHaveLength(8);
    // Bloc « Catégories » masqué par défaut (événement sans catégories)
    expect(config.blocks.find((b) => b.type === "categories")?.visible).toBe(false);
    expect(config.blocks.map((b) => b.type).sort()).toEqual([...BLOCK_TYPES].sort());
    expect(config).not.toHaveProperty("video");
  });

  it("aucun bloc par défaut ne déborde de la surface 1920×1080", () => {
    for (const b of defaultShowConfig().blocks) {
      expect(b.x + b.w).toBeLessThanOrEqual(100);
      expect(b.y + b.h).toBeLessThanOrEqual(100);
    }
  });

  it("normalise une configuration partielle ou corrompue", () => {
    const config = normalizeShowConfig({ theme: "nature", blocks: [{ type: "total", x: 10, y: 10, w: 30, h: 20, visible: true, align: "center", fontScale: 1 }, { type: "inconnu" }] });
    expect(config.theme).toBe("nature");
    expect(config.blocks).toHaveLength(BLOCK_TYPES.length);
    expect(config.blocks[0].type).toBe("total");
    expect(config.blocks.find((b) => b.type === "qrcode")?.visible).toBe(false);
    expect(normalizeShowConfig(null).theme).toBe("gala");
    expect(normalizeShowConfig({ theme: "inexistant" }).theme).toBe("gala");
  });

  it("normalise sans erreur une ancienne configuration avec bloc vidéo", () => {
    const current = defaultShowConfig("royal");
    const legacy = {
      ...current,
      texts: { ...current.texts, message: "Merci" },
      video: { url: "https://vimeo.com/123456789", muted: false, loop: true, fit: "contain" },
      blocks: [
        { type: "video", x: 3, y: 4, w: 56, h: 62, visible: true, align: "center", fontScale: 1 },
        ...current.blocks.map((b) => (b.type === "total" ? { ...b, x: 62, y: 38, w: 35, h: 18 } : b)),
      ],
    };
    const config = normalizeShowConfig(legacy);
    expect(showConfigSchema.safeParse(config).success).toBe(true);
    expect(config).not.toHaveProperty("video");
    expect(config.blocks.map((b) => b.type)).toEqual(current.blocks.map((b) => b.type));
    // Le reste de l'ancienne configuration est conservé.
    expect(config.theme).toBe("royal");
    expect(config.texts.message).toBe("Merci");
    expect(config.blocks.find((b) => b.type === "total")).toMatchObject({ x: 62, y: 38, w: 35, h: 18, visible: true });
  });

  it("supprime les blocs en double", () => {
    const block = { type: "logo", x: 0, y: 0, w: 10, h: 10, visible: true, align: "start", fontScale: 1 };
    expect(normalizeShowConfig({ blocks: [block, block] }).blocks.filter((b) => b.type === "logo")).toHaveLength(1);
  });

  it("maintient un bloc dans la surface", () => {
    const b = clampBlock({ type: "title", x: 95, y: -5, w: 30, h: 20, visible: true, align: "start", fontScale: 1 });
    expect(b.x).toBe(70);
    expect(b.y).toBe(0);
  });

  it("convertit pourcentages ↔ pixels sans perte", () => {
    const px = blockToPixels({ x: 25, y: 50, w: 50, h: 25 });
    expect(px).toEqual({ left: 480, top: 540, width: 960, height: 270 });
    expect(pixelsToBlock(px)).toEqual({ x: 25, y: 50, w: 50, h: 25 });
  });

  it("met à l'échelle Full HD et 4K", () => {
    expect(fitScale(1920, 1080)).toBe(1);
    expect(fitScale(3840, 2160)).toBe(2);
    expect(fitScale(1280, 1024)).toBeCloseTo(1280 / 1920);
  });
});

describe("bibliothèque d'arrière-plans", () => {
  it("propose au moins 10 arrière-plans, dont les 5 identifiants historiques", () => {
    expect(THEME_IDS.length).toBeGreaterThanOrEqual(10);
    for (const id of ["gala", "moderne", "minimal", "feerie", "nature"]) expect(THEME_IDS).toContain(id);
    expect(BACKGROUND_LIST.map((b) => b.id)).toEqual([...THEME_IDS]);
  });

  it.each(THEME_IDS)("l'arrière-plan « %s » fournit toutes les variables CSS du show", (id) => {
    const vars = themeCssVars({ theme: id, colors: { accent: null, text: null } });
    expect(Object.keys(vars).sort()).toEqual([...SHOW_CSS_VARS].sort());
    for (const name of SHOW_CSS_VARS) expect(vars[name], name).toMatch(/\S/);
  });

  it.each(THEME_IDS)("l'arrière-plan « %s » est complet, 100 % CSS / SVG inline et sans couleurs imposées", (id) => {
    const def = BACKGROUNDS[id];
    expect(def.id).toBe(id);
    expect(def.label.fr.trim()).not.toBe("");
    expect(def.label.he.trim()).not.toBe("");
    expect(def.tagline.fr.trim()).not.toBe("");
    expect(def.tagline.he.trim()).not.toBe("");
    expect(def.lockedColors).toBe(false);
    const scene = backgroundScene(id);
    expect(scene.length).toBeGreaterThan(20);
    // Aucune ressource externe : seules des images SVG en data-URI.
    expect(scene).not.toMatch(/url\("(?!data:image\/svg\+xml,)/);
    expect(scene).not.toMatch(/url\((?!"data:|%23)/);
    for (const [, data] of scene.matchAll(/url\("data:image\/svg\+xml,([^"]*)"\)/g)) {
      expect(decodeURIComponent(data)).not.toMatch(/(href|src)=['"]?(https?:|\/\/)|<image|@import/);
    }
    expect(AMBIENT_ELEMENT_COUNT[def.ambient]).toBeLessThanOrEqual(20);
  });

  it("les couleurs personnalisées des éléments priment sur la palette", () => {
    const vars = themeCssVars({ theme: "gala", colors: { accent: "#ff0000", text: "#00ff00" } });
    expect(vars["--show-accent"]).toBe("#ff0000");
    expect(vars["--show-text"]).toBe("#00ff00");
    expect(vars["--show-bg"]).toBe(BACKGROUNDS.gala.vars.bg);
  });

  it("une ancienne couleur de fond personnalisée est ignorée", () => {
    const vars = themeCssVars({ theme: "nature", colors: { accent: null, text: null, background: "#000011" } });
    expect(vars["--show-bg"]).toBe(BACKGROUNDS.nature.vars.bg);
  });

  it("normalise sans erreur une ancienne configuration avec fond image / vidéo et couleur de fond", () => {
    const legacy = {
      ...defaultShowConfig("feerie"),
      colors: { accent: "#123456", text: null, background: "#000011" },
      backgroundImage: "/api/media/abc123",
      backgroundVideo: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      backgroundDim: 0.6,
    };
    const config = normalizeShowConfig(legacy);
    expect(showConfigSchema.safeParse(config).success).toBe(true);
    expect(config.theme).toBe("feerie");
    expect(config.colors).toEqual({ accent: "#123456", text: null });
    for (const key of ["backgroundImage", "backgroundVideo", "backgroundDim"]) expect(config).not.toHaveProperty(key);
    // Les blocs et réglages de l'ancienne configuration sont conservés.
    expect(config.blocks).toEqual(legacy.blocks);
  });

  it("ignore une couleur personnalisée invalide sans perdre le reste de la configuration", () => {
    const config = normalizeShowConfig({ theme: "aurore", colors: { accent: "rouge", text: "#ffffff" }, texts: { message: "Merci" } });
    expect(config.theme).toBe("aurore");
    expect(config.colors).toEqual({ accent: null, text: "#ffffff" });
    expect(config.texts.message).toBe("Merci");
  });
});

describe("ajustement du texte", () => {
  it("réduit la police pour un texte long", () => {
    const short = fitFontSize("Gala", 600, 200, { max: 120 });
    const long = fitFontSize("Soirée de solidarité annuelle de l'association Espoir pour demain", 600, 200, { max: 120 });
    expect(long).toBeLessThan(short);
    expect(long).toBeGreaterThanOrEqual(12);
  });
});

describe("bloc Objectif", () => {
  const render = (goal: number, locale: "fr" | "he" = "fr") =>
    renderToStaticMarkup(
      createElement(GoalFigures, { goal, currency: locale === "he" ? "ILS" : "EUR", locale, t: dictionaries[locale].show, width: 854, height: 108 }),
    ).replace(/[  ‎‏]/g, " ");

  it("affiche uniquement le montant de l'objectif : ni barre, ni jauge, ni pourcentage", () => {
    const html = render(10000);
    expect(html).toContain("Objectif");
    expect(html).toContain("10 000 €");
    expect(html).not.toMatch(/show-bar|show-track|progress|%|Reste/);
  });

  it("est traduit en hébreu", () => {
    const html = render(900, "he");
    expect(html).toContain("יעד");
    expect(html).toContain("900");
    expect(html).not.toContain("%");
  });
});
