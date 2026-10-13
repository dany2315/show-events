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
} from "@/lib/show/config";
import { themeCssVars, THEMES } from "@/lib/show/themes";
import { fitFontSize } from "@/components/show/fit";

describe("configuration du show", () => {
  it("la configuration par défaut est valide et contient les 7 blocs du cahier des charges", () => {
    const config = defaultShowConfig();
    expect(showConfigSchema.safeParse(config).success).toBe(true);
    expect(config.blocks.map((b) => b.type).sort()).toEqual([...BLOCK_TYPES].sort());
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

describe("thèmes", () => {
  it("chaque thème fournit les variables CSS du show", () => {
    for (const id of Object.keys(THEMES) as (keyof typeof THEMES)[]) {
      const vars = themeCssVars({ theme: id, colors: { accent: null, text: null, background: null } });
      expect(vars["--show-bg"]).toBeTruthy();
      expect(vars["--show-accent"]).toBeTruthy();
    }
  });
  it("les couleurs personnalisées priment sur le thème", () => {
    const vars = themeCssVars({ theme: "gala", colors: { accent: "#ff0000", text: "#00ff00", background: "#000011" } });
    expect(vars["--show-accent"]).toBe("#ff0000");
    expect(vars["--show-text"]).toBe("#00ff00");
    expect(vars["--show-bg"]).toBe("#000011");
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
