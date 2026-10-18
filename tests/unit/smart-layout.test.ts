import { describe, expect, it } from "vitest";
import { BLOCK_TYPES, defaultShowConfig } from "@/lib/show/config";
import { applyPreset, autoLayout, findOverlaps, fixOverlaps, LAYOUT_PRESETS, pickPreset } from "@/lib/show/smart-layout";

const allVisible = () => {
  const c = defaultShowConfig();
  c.blocks = c.blocks.map((b) => ({ ...b, visible: true }));
  return c;
};

describe("mise en page intelligente", () => {
  it.each(LAYOUT_PRESETS)(`la mise en page « %s » place les ${BLOCK_TYPES.length} blocs sans chevauchement ni débordement`, (preset) => {
    for (const rtl of [false, true]) {
      const config = applyPreset(allVisible(), preset, rtl);
      expect(config.blocks).toHaveLength(BLOCK_TYPES.length);
      expect(findOverlaps(config.blocks)).toEqual([]);
      for (const b of config.blocks) {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.x + b.w).toBeLessThanOrEqual(100.01);
        expect(b.y + b.h).toBeLessThanOrEqual(100.01);
      }
    }
  });

  it("propose uniquement les mises en page des éléments du show (aucune mise en page vidéo)", () => {
    expect([...LAYOUT_PRESETS]).toEqual(["classic", "spotlight", "donors", "minimal"]);
  });

  it("la mise en page « Classique » reprend la disposition par défaut", () => {
    const config = defaultShowConfig();
    expect(applyPreset(config, "classic", false).blocks).toEqual(config.blocks);
  });

  it("conserve la visibilité et l'ordre des calques choisis par l'utilisateur", () => {
    const config = defaultShowConfig();
    config.blocks = config.blocks.map((b) => (b.type === "message" ? { ...b, visible: false } : b));
    const result = applyPreset(config, "spotlight", false);
    expect(result.blocks.map((b) => [b.type, b.visible])).toEqual(config.blocks.map((b) => [b.type, b.visible]));
  });

  it("retourne la mise en page pour l'hébreu (lecture de droite à gauche)", () => {
    const ltr = applyPreset(allVisible(), "donors", false).blocks.find((b) => b.type === "donations")!;
    const rtl = applyPreset(allVisible(), "donors", true).blocks.find((b) => b.type === "donations")!;
    expect(rtl.x).toBeCloseTo(100 - ltr.x - ltr.w);
    expect(rtl.y).toBe(ltr.y);
  });

  it("choisit automatiquement selon les blocs affichés", () => {
    const c = defaultShowConfig();
    expect(pickPreset(c)).toBe("classic");
    expect(pickPreset({ ...c, donations: { ...c.donations, count: 12 } })).toBe("donors");
    const noTexts = { ...c, blocks: c.blocks.map((b) => (b.type === "title" || b.type === "message" ? { ...b, visible: false } : b)) };
    expect(pickPreset(noTexts)).toBe("spotlight");
    c.blocks = c.blocks.map((b) => (b.type === "donations" ? { ...b, visible: false } : b));
    expect(pickPreset(c)).toBe("minimal");
    expect(autoLayout(defaultShowConfig(), false).preset).toBe("classic");
  });

  it("corrige les chevauchements créés à la main", () => {
    const c = allVisible();
    c.blocks = c.blocks.map((b, i) => ({ ...b, x: 10 + i, y: 10 + i, w: 20, h: 15 }));
    expect(findOverlaps(c.blocks).length).toBeGreaterThan(0);
    const fixed = fixOverlaps(c);
    expect(findOverlaps(fixed.blocks)).toEqual([]);
    expect(fixed.blocks.map((b) => b.type).sort()).toEqual([...BLOCK_TYPES].sort());
  });

  it("ignore les blocs masqués", () => {
    const c = defaultShowConfig();
    c.blocks = c.blocks.map((b) => (b.type === "qrcode" ? { ...b, visible: false, x: 37, y: 5, w: 44.5, h: 26 } : b));
    expect(findOverlaps(c.blocks)).toEqual([]);
  });
});
