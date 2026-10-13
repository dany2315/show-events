import type { ShowConfig, ThemeId } from "./config";

export type AmbientKind = "sparkles" | "rays" | "none" | "stars" | "bokeh";

export type ThemeDefinition = {
  id: ThemeId;
  label: { fr: string; he: string };
  tagline: { fr: string; he: string };
  dark: boolean;
  /** Famille de titres : « serif » (élégant) ou « sans » (moderne). */
  display: "serif" | "sans";
  ambient: AmbientKind;
  vars: {
    bg: string;
    bg2: string;
    text: string;
    muted: string;
    accent: string;
    accent2: string;
    panel: string;
    panelBorder: string;
    track: string;
    qrCard: string;
  };
};

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  gala: {
    id: "gala",
    label: { fr: "Gala Premium", he: "גאלה פרימיום" },
    tagline: { fr: "Noir profond et or, pour les grandes soirées", he: "שחור עמוק וזהב, לערבי גאלה" },
    dark: true,
    display: "serif",
    ambient: "sparkles",
    vars: {
      bg: "#07060a",
      bg2: "#2a1d07",
      text: "#fbf4e2",
      muted: "rgba(251, 244, 226, 0.62)",
      accent: "#e4b65c",
      accent2: "#fff0c2",
      panel: "rgba(18, 14, 8, 0.62)",
      panelBorder: "rgba(228, 182, 92, 0.32)",
      track: "rgba(255, 255, 255, 0.12)",
      qrCard: "#fffaf0",
    },
  },
  moderne: {
    id: "moderne",
    label: { fr: "Moderne", he: "מודרני" },
    tagline: { fr: "Lumineux, bleu et blanc, très lisible", he: "בהיר, כחול ולבן, קריא במיוחד" },
    dark: false,
    display: "sans",
    ambient: "rays",
    vars: {
      bg: "#f1f6ff",
      bg2: "#bcd4ff",
      text: "#0a1d44",
      muted: "rgba(10, 29, 68, 0.6)",
      accent: "#1f5fe0",
      accent2: "#57a2ff",
      panel: "rgba(255, 255, 255, 0.78)",
      panelBorder: "rgba(31, 95, 224, 0.16)",
      track: "rgba(10, 29, 68, 0.1)",
      qrCard: "#ffffff",
    },
  },
  minimal: {
    id: "minimal",
    label: { fr: "Minimaliste", he: "מינימליסטי" },
    tagline: { fr: "Épuré, typographique, sans artifice", he: "נקי וטיפוגרפי" },
    dark: false,
    display: "sans",
    ambient: "none",
    vars: {
      bg: "#f5f2ec",
      bg2: "#ebe5da",
      text: "#141414",
      muted: "rgba(20, 20, 20, 0.55)",
      accent: "#e0482d",
      accent2: "#ff8a6b",
      panel: "rgba(255, 255, 255, 0.9)",
      panelBorder: "rgba(20, 20, 20, 0.1)",
      track: "rgba(20, 20, 20, 0.08)",
      qrCard: "#ffffff",
    },
  },
  feerie: {
    id: "feerie",
    label: { fr: "Féerie", he: "קסם" },
    tagline: { fr: "Violet nuit et étoiles, pour l'enfance et le rêve", he: "סגול לילה וכוכבים" },
    dark: true,
    display: "sans",
    ambient: "stars",
    vars: {
      bg: "#0f0628",
      bg2: "#5a1aa8",
      text: "#ffffff",
      muted: "rgba(255, 255, 255, 0.66)",
      accent: "#ffcf3f",
      accent2: "#ff6bd0",
      panel: "rgba(26, 10, 62, 0.6)",
      panelBorder: "rgba(255, 207, 63, 0.3)",
      track: "rgba(255, 255, 255, 0.14)",
      qrCard: "#ffffff",
    },
  },
  nature: {
    id: "nature",
    label: { fr: "Nature", he: "טבע" },
    tagline: { fr: "Vert profond et lumière, pour les causes durables", he: "ירוק עמוק ואור" },
    dark: true,
    display: "serif",
    ambient: "bokeh",
    vars: {
      bg: "#03150d",
      bg2: "#155c34",
      text: "#f2fbe8",
      muted: "rgba(242, 251, 232, 0.64)",
      accent: "#a6e35f",
      accent2: "#eefaa0",
      panel: "rgba(4, 28, 17, 0.6)",
      panelBorder: "rgba(166, 227, 95, 0.3)",
      track: "rgba(255, 255, 255, 0.12)",
      qrCard: "#ffffff",
    },
  },
};

/** Variables CSS effectives du show (thème + couleurs personnalisées du Studio). */
export function themeCssVars(config: Pick<ShowConfig, "theme" | "colors">): Record<string, string> {
  const theme = THEMES[config.theme] ?? THEMES.gala;
  const v = { ...theme.vars };
  if (config.colors.accent) v.accent = config.colors.accent;
  if (config.colors.text) {
    v.text = config.colors.text;
    v.muted = hexToRgba(config.colors.text, 0.62);
  }
  if (config.colors.background) {
    v.bg = config.colors.background;
    v.bg2 = mix(config.colors.background, v.accent, 0.28);
  }
  return {
    "--show-bg": v.bg,
    "--show-bg2": v.bg2,
    "--show-text": v.text,
    "--show-muted": v.muted,
    "--show-accent": v.accent,
    "--show-accent2": v.accent2,
    "--show-panel": v.panel,
    "--show-panel-border": v.panelBorder,
    "--show-track": v.track,
    "--show-qr-card": v.qrCard,
    "--show-display":
      theme.display === "serif" ? "var(--font-playfair), var(--font-frank), Georgia, serif" : "var(--font-sans), sans-serif",
  };
}

export function hexToRgba(hex: string, alpha: number) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
}

function mix(a: string, b: string, t: number) {
  const pa = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(a);
  const pb = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(b);
  if (!pa || !pb) return a;
  const c = [1, 2, 3].map((i) => Math.round(parseInt(pa[i], 16) * (1 - t) + parseInt(pb[i], 16) * t));
  return "#" + c.map((n) => n.toString(16).padStart(2, "0")).join("");
}
