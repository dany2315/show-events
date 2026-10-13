import { describe, expect, it } from "vitest";
import { BLOCK_TYPES, defaultShowConfig } from "@/lib/show/config";
import { applyPreset, autoLayout, findOverlaps, fixOverlaps, LAYOUT_PRESETS, pickPreset } from "@/lib/show/smart-layout";
import { parseVideoSource, embedUrl } from "@/lib/show/media";

const allVisible = () => {
  const c = defaultShowConfig();
  c.blocks = c.blocks.map((b) => ({ ...b, visible: true }));
  return c;
};

describe("mise en page intelligente", () => {
  it.each(LAYOUT_PRESETS)("la mise en page « %s » place les 8 blocs sans chevauchement ni débordement", (preset) => {
    for (const rtl of [false, true]) {
      const config = applyPreset(allVisible(), preset, rtl);
      expect(findOverlaps(config.blocks)).toEqual([]);
      for (const b of config.blocks) {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.x + b.w).toBeLessThanOrEqual(100.01);
        expect(b.y + b.h).toBeLessThanOrEqual(100.01);
      }
    }
  });

  it("conserve la visibilité et l'ordre des calques choisis par l'utilisateur", () => {
    const config = defaultShowConfig();
    const result = applyPreset(config, "spotlight", false);
    expect(result.blocks.map((b) => [b.type, b.visible])).toEqual(config.blocks.map((b) => [b.type, b.visible]));
  });

  it("retourne la mise en page pour l'hébreu (lecture de droite à gauche)", () => {
    const ltr = applyPreset(allVisible(), "video", false).blocks.find((b) => b.type === "video")!;
    const rtl = applyPreset(allVisible(), "video", true).blocks.find((b) => b.type === "video")!;
    expect(rtl.x).toBeCloseTo(100 - ltr.x - ltr.w);
    expect(rtl.y).toBe(ltr.y);
  });

  it("choisit automatiquement selon les blocs affichés", () => {
    const c = defaultShowConfig();
    expect(pickPreset(c)).toBe("classic");
    c.blocks = c.blocks.map((b) => (b.type === "video" ? { ...b, visible: true } : b));
    expect(pickPreset(c)).toBe("video");
    c.blocks = c.blocks.map((b) => (b.type === "video" ? { ...b, visible: false } : b.type === "donations" ? { ...b, visible: false } : b));
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
    c.blocks = c.blocks.map((b) => (b.type === "video" ? { ...b, x: 37, y: 5, w: 44.5, h: 26 } : b));
    expect(findOverlaps(c.blocks)).toEqual([]);
  });
});

describe("sources vidéo", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtube"],
    ["https://youtu.be/dQw4w9WgXcQ", "youtube"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "youtube"],
    ["https://vimeo.com/123456789", "vimeo"],
    ["https://exemple.org/clip.mp4", "file"],
    ["/api/media/abcdef1234567890", "file"],
  ])("%s → %s", (url, kind) => {
    expect(parseVideoSource(url)?.kind).toBe(kind);
  });

  it.each(["http://exemple.org/clip.mp4", "https://exemple.org/page.html", "javascript:alert(1)", "", null])("refuse %s", (url) => {
    expect(parseVideoSource(url as string)).toBeNull();
  });

  it("intègre YouTube en lecture automatique, muette et en boucle", () => {
    const src = embedUrl({ kind: "youtube", id: "dQw4w9WgXcQ" }, { muted: true, loop: true });
    expect(src).toContain("autoplay=1");
    expect(src).toContain("mute=1");
    expect(src).toContain("loop=1");
    expect(src).toContain("youtube-nocookie.com");
  });
});
