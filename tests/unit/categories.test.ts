import { describe, expect, it } from "vitest";
import { applyCategoryDelta, categoriesInputSchema, contrastText, parseCategoriesField, type PublicCategory } from "@/lib/categories";
import { defaultShowConfig, normalizeShowConfig } from "@/lib/show/config";
import { carveCategories, hideCategoriesBlock, revealCategoriesBlock } from "@/lib/show/categories-layout";
import { applyPreset, findOverlaps, LAYOUT_PRESETS } from "@/lib/show/smart-layout";
import { liveReducer } from "@/components/show/use-live-event";
import { demoEvent } from "@/lib/show/demo";
import { EMPTY_CONTROL, type LiveMessage, type LiveSnapshot } from "@/lib/live/types";

const cats = (): PublicCategory[] => [
  { id: "a", name: "Parrains", color: "#e4b65c", total: 1000, count: 2 },
  { id: "b", name: "Familles", color: "#5b9cf5", total: 0, count: 0 },
];

describe("catégories de donateurs : saisie", () => {
  it("au plus 3 catégories, nom requis, couleur hexadécimale", () => {
    expect(categoriesInputSchema.safeParse([{ name: "Parrains", color: "#E4B65C" }]).data?.[0].color).toBe("#e4b65c");
    const four = Array.from({ length: 4 }, (_, i) => ({ name: `C${i}`, color: "#112233" }));
    expect(categoriesInputSchema.safeParse(four).success).toBe(false);
    expect(categoriesInputSchema.safeParse([{ name: " ", color: "#112233" }]).success).toBe(false);
    expect(categoriesInputSchema.safeParse([{ name: "X", color: "red" }]).success).toBe(false);
    expect(categoriesInputSchema.safeParse([{ name: "x".repeat(31), color: "#112233" }]).success).toBe(false);
  });

  it("champ caché du formulaire : vide = aucune catégorie, JSON illisible refusé", () => {
    expect(parseCategoriesField(null)).toEqual([]);
    expect(parseCategoriesField("")).toEqual([]);
    expect(() => parseCategoriesField("{pas du json")).toThrow();
  });

  it("texte lisible sur chaque pastille", () => {
    expect(contrastText("#e4b65c")).toBe("#111111");
    expect(contrastText("#1d2b6b")).toBe("#ffffff");
  });
});

describe("catégories de donateurs : totaux en direct", () => {
  it("incrémente et décrémente la bonne catégorie, ignore l'inconnue", () => {
    expect(applyCategoryDelta(cats(), "b", 500, 1).find((c) => c.id === "b")).toMatchObject({ total: 500, count: 1 });
    expect(applyCategoryDelta(cats(), "a", -400, -1).find((c) => c.id === "a")).toMatchObject({ total: 600, count: 1 });
    const same = cats();
    expect(applyCategoryDelta(same, "zzz", 500, 1)).toBe(same);
    expect(applyCategoryDelta(same, null, 500, 1)).toBe(same);
  });

  const snapshot = (): LiveSnapshot => ({
    seq: 10,
    event: { ...demoEvent("fr"), categories: cats() },
    total: 1000,
    count: 2,
    donations: [],
    control: EMPTY_CONTROL,
    layout: defaultShowConfig(),
    layoutVersion: 1,
    formUrl: null,
  });
  const run = (messages: LiveMessage[]) => liveReducer({ ...snapshot(), effect: null, effectSeq: 0 }, { type: "messages", messages, withEffects: false });
  const donation = (id: string, amount: number, categoryId: string | null) => ({ id, donorName: "Sarah Cohen", amount, createdAt: new Date().toISOString(), categoryId });

  it("promesse créée, corrigée (montant et catégorie), puis supprimée", () => {
    let state = run([{ seq: 11, type: "donation.created", donation: donation("d1", 300, "b"), total: 1300, count: 3 }]);
    expect(state.event.categories?.find((c) => c.id === "b")).toMatchObject({ total: 300, count: 1 });

    state = liveReducer(state, {
      type: "messages",
      withEffects: false,
      messages: [{ seq: 12, type: "donation.updated", donation: donation("d1", 450, "a"), previous: { amount: 300, categoryId: "b" }, total: 1450, count: 3 }],
    });
    expect(state.event.categories?.find((c) => c.id === "b")).toMatchObject({ total: 0, count: 0 });
    expect(state.event.categories?.find((c) => c.id === "a")).toMatchObject({ total: 1450, count: 3 });

    state = liveReducer(state, {
      type: "messages",
      withEffects: false,
      messages: [{ seq: 13, type: "donation.deleted", donationId: "d1", removed: { amount: 450, categoryId: "a" }, total: 1000, count: 2 }],
    });
    expect(state.event.categories?.find((c) => c.id === "a")).toMatchObject({ total: 1000, count: 2 });
  });

  it("un message déjà inclus dans l'état (séquence passée) n'est jamais compté deux fois", () => {
    const state = run([{ seq: 9, type: "donation.created", donation: donation("old", 999, "a"), total: 1999, count: 3 }]);
    expect(state.event.categories?.find((c) => c.id === "a")?.total).toBe(1000);
  });
});

describe("bloc « Catégories » sur l'écran", () => {
  const visibleAll = () => {
    const c = defaultShowConfig();
    c.blocks = c.blocks.map((b) => ({ ...b, visible: true }));
    return c;
  };

  it("les anciennes configurations reçoivent le bloc, masqué", () => {
    const legacy = { ...defaultShowConfig(), blocks: defaultShowConfig().blocks.filter((b) => b.type !== "categories") };
    const config = normalizeShowConfig(legacy);
    expect(config.blocks.find((b) => b.type === "categories")).toMatchObject({ visible: false });
  });

  it("apparaît avec les premières catégories, sans chevauchement, en haut de la liste des dons", () => {
    for (const rtl of [false, true]) {
      const config = revealCategoriesBlock(defaultShowConfig(), rtl);
      const block = config.blocks.find((b) => b.type === "categories")!;
      const donations = config.blocks.find((b) => b.type === "donations")!;
      expect(block.visible).toBe(true);
      expect(findOverlaps(config.blocks)).toEqual([]);
      expect(block.y).toBeLessThan(donations.y);
      expect(block.w).toBeCloseTo(donations.w);
    }
  });

  it("disparaît avec la dernière catégorie : la liste des dons reprend toute sa place", () => {
    const initial = defaultShowConfig();
    const hidden = hideCategoriesBlock(revealCategoriesBlock(initial, false));
    expect(hidden.blocks.find((b) => b.type === "categories")?.visible).toBe(false);
    expect(hidden.blocks.find((b) => b.type === "donations")).toEqual(initial.blocks.find((b) => b.type === "donations"));
  });

  it("liste des dons basse : colonne en fin de ligne (à gauche en hébreu)", () => {
    const base = visibleAll();
    base.blocks = base.blocks.map((b) => (b.type === "donations" ? { ...b, x: 3, y: 75, w: 60, h: 21 } : b));
    const ltr = carveCategories(base.blocks, false);
    const rtl = carveCategories(base.blocks, true);
    const pick = (blocks: typeof ltr, t: string) => blocks.find((b) => b.type === t)!;
    expect(pick(ltr, "categories").x).toBeGreaterThan(pick(ltr, "donations").x);
    expect(pick(rtl, "categories").x).toBeLessThan(pick(rtl, "donations").x);
    expect(findOverlaps([pick(ltr, "categories"), pick(ltr, "donations")])).toEqual([]);
  });

  it.each(LAYOUT_PRESETS)("mise en page « %s » : le bloc trouve sa place quand il est affiché", (preset) => {
    for (const rtl of [false, true]) {
      const config = applyPreset(visibleAll(), preset, rtl);
      expect(findOverlaps(config.blocks)).toEqual([]);
    }
  });
});
