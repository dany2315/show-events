import { z } from "zod";

/**
 * Catégories de donateurs (au plus 3 par événement) : nom + couleur, total affiché sur l'écran.
 * Module partagé client / serveur. Les données publiques d'une catégorie se limitent à
 * son identifiant, son nom, sa couleur et ses montants : rien de personnel.
 */
export const MAX_CATEGORIES = 3;
export const MAX_CATEGORY_NAME_LENGTH = 30;

/** Palette proposée dans le formulaire de l'événement (lisible sur tous les arrière-plans). */
export const CATEGORY_COLORS = ["#e4b65c", "#5b9cf5", "#4fc28c", "#e5677d", "#a77ff0", "#f08a4b", "#3cc3c9", "#cfd6e4"] as const;

export type CategoryDef = { id: string; name: string; color: string };
export type PublicCategory = CategoryDef & { total: number; count: number };

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/** Saisie du formulaire de l'événement (champ caché JSON) : id absent = nouvelle catégorie. */
export const categoriesInputSchema = z
  .array(
    z.object({
      id: z.string().min(1).max(40).optional(),
      name: z.string().trim().min(1).max(MAX_CATEGORY_NAME_LENGTH),
      color: hex.transform((v) => v.toLowerCase()),
    }),
  )
  .max(MAX_CATEGORIES);
export type CategoryInput = z.infer<typeof categoriesInputSchema>[number];

export function parseCategoriesField(raw: FormDataEntryValue | null) {
  if (raw === null || raw === "") return [];
  let value: unknown = null;
  try {
    value = JSON.parse(String(raw));
  } catch {
    // JSON illisible : refusé par le schéma ci-dessous (erreur de validation, pas d'erreur serveur).
  }
  return categoriesInputSchema.parse(value);
}

/** Applique une variation (promesse créée, corrigée ou supprimée) aux totaux par catégorie. */
export function applyCategoryDelta(categories: PublicCategory[], categoryId: string | null | undefined, amount: number, count: number) {
  if (!categoryId || (amount === 0 && count === 0)) return categories;
  if (!categories.some((c) => c.id === categoryId)) return categories;
  return categories.map((c) => (c.id === categoryId ? { ...c, total: c.total + amount, count: c.count + count } : c));
}

/** Couleur de texte lisible sur une pastille de la couleur donnée. */
export function contrastText(color: string) {
  const n = Number.parseInt(color.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#111111" : "#ffffff";
}
