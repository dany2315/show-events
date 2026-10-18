import type { PublicDonation } from "./types";

/**
 * Promesse telle que diffusée au public (écran géant, temps réel, API publique).
 * Liste blanche explicite : ni coordonnées (téléphone, e-mail), ni prénom / nom séparés,
 * ni indicateur réel / fictif — uniquement le nom affiché et le montant.
 */
export function toPublicDonation(d: { id: string; donorName: string; amount: number; createdAt: Date }): PublicDonation {
  return { id: d.id, donorName: d.donorName, amount: d.amount, createdAt: d.createdAt.toISOString() };
}
