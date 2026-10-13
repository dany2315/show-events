/**
 * Calcule une taille de police qui fait tenir un texte dans une boîte (approximation
 * par largeur moyenne de caractère, suffisante pour un rendu stable et sans mesure DOM).
 */
export function fitFontSize(
  text: string,
  width: number,
  height: number,
  opts: { max: number; min?: number; charWidth?: number; lineHeight?: number; maxLines?: number } = { max: 120 },
) {
  const { max, min = 12, charWidth = 0.55, lineHeight = 1.12, maxLines = 4 } = opts;
  const length = Math.max(1, text.length);
  const words = text.split(/\s+/).filter(Boolean);
  const longestWord = words.reduce((m, w) => Math.max(m, w.length), 1);
  for (let fs = max; fs >= min; fs -= Math.max(1, fs * 0.04)) {
    const charsPerLine = Math.floor(width / (fs * charWidth));
    if (charsPerLine < 1 || longestWord > charsPerLine * 1.05) continue;
    const lines = Math.ceil(length / charsPerLine);
    if (lines > maxLines) continue;
    if (lines * fs * lineHeight <= height) return fs;
  }
  return min;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/** Typographie française : espace fine insécable avant « ! ? : ; » (évite « ! » seul en début de ligne). */
export function typo(text: string, locale: "fr" | "he") {
  if (locale !== "fr") return text;
  return text.replace(/\s+([!?:;»])/g, " $1").replace(/«\s+/g, "« ");
}
