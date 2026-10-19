/**
 * Emplacement du badge « MODE TEST » / « APERÇU » sur l'écran géant.
 * Le badge ne doit jamais recouvrir un bloc du show (logo, total, QR code…), quel que soit
 * le format d'écran ou la mise en page personnalisée : on essaie plusieurs emplacements le
 * long des bords et on retient le premier libre (sinon celui qui recouvre le moins).
 */
export type Rect = { left: number; top: number; width: number; height: number };

/** Taille estimée du badge (px de la surface du show) pour un libellé en capitales espacées. */
export function badgeSize(label: string, fontSize: number) {
  return { width: Math.ceil(label.length * fontSize * 0.86 + fontSize * 2.2), height: Math.ceil(fontSize * 1.9) };
}

function overlap(a: Rect, b: Rect) {
  const w = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
  const h = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}

export function pickBadgeSlot(blocks: Rect[], stage: { width: number; height: number }, size: { width: number; height: number }, margin = 12): Rect {
  const { width, height } = size;
  const cx = (stage.width - width) / 2;
  const top = margin;
  const bottom = stage.height - height - margin;
  const end = stage.width - width - margin;
  // Ordre de préférence : haut centré, bas centré, puis les coins.
  const candidates: Rect[] = [
    { left: cx, top, width, height },
    { left: cx, top: bottom, width, height },
    { left: margin, top, width, height },
    { left: end, top, width, height },
    { left: margin, top: bottom, width, height },
    { left: end, top: bottom, width, height },
    // Entre le centre et les coins (quarts de la largeur), utiles sur les surfaces très larges.
    { left: stage.width * 0.25 - width / 2, top, width, height },
    { left: stage.width * 0.75 - width / 2, top, width, height },
    { left: stage.width * 0.25 - width / 2, top: bottom, width, height },
    { left: stage.width * 0.75 - width / 2, top: bottom, width, height },
  ].map((c) => ({ ...c, left: Math.max(margin, Math.min(c.left, end)) }));
  let best = candidates[0]!;
  let bestArea = Infinity;
  for (const c of candidates) {
    const area = blocks.reduce((sum, b) => sum + overlap(c, b), 0);
    if (area === 0) return c;
    if (area < bestArea) {
      best = c;
      bestArea = area;
    }
  }
  return best;
}

/**
 * Place le badge : taille de police de base si possible, sinon un peu plus petite (bandeau
 * étroit entre les blocs et le bord de l'écran), toujours sans recouvrir de bloc si un
 * emplacement libre existe.
 */
export function placeBadge(label: string, blocks: Rect[], stage: { width: number; height: number }, baseFont: number) {
  let fallback: (Rect & { fontSize: number }) | null = null;
  for (const scale of [1, 0.85, 0.72, 0.6]) {
    const fontSize = Math.round(baseFont * scale);
    const size = badgeSize(label, fontSize);
    for (const margin of [12, 6]) {
      const slot = pickBadgeSlot(blocks, stage, size, margin);
      if (!blocks.some((b) => overlap(slot, b) > 0)) return { ...slot, fontSize };
      fallback ??= { ...slot, fontSize };
    }
  }
  return fallback!;
}
