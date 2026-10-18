import { THEME_IDS, type ShowConfig, type ThemeId } from "./config";
import { sceneBackground } from "./scenes";

/**
 * Bibliothèque d'arrière-plans proposés par la plateforme.
 *
 * Chaque arrière-plan réunit un décor (dessin CSS / SVG inline, voir `scenes.ts`), une ambiance
 * animée légère et sa palette par défaut. Les associations ne peuvent plus importer leur propre
 * fond : elles choisissent un arrière-plan et peuvent (pour l'instant) ajuster les couleurs
 * d'accent et de texte des éléments. Le décor garde toujours ses propres couleurs.
 *
 * L'identifiant est stocké dans la configuration du show (champ historique `theme`).
 */

/** Ambiances animées (uniquement transform / opacity, 20 éléments animés au plus). */
export type AmbientKind = "sparkles" | "rays" | "none" | "stars" | "bokeh" | "aurora" | "dust" | "sheen" | "glints";

export type BackgroundId = ThemeId;

export type BackgroundDefinition = {
  id: BackgroundId;
  label: { fr: string; he: string };
  tagline: { fr: string; he: string };
  /** Décor sombre (texte clair) ou lumineux (texte foncé). */
  dark: boolean;
  /** Famille de titres : « serif » (élégant) ou « sans » (moderne). */
  display: "serif" | "sans";
  ambient: AmbientKind;
  /**
   * Règle future « couleurs imposées » : si vrai, les couleurs personnalisées du Studio
   * seront ignorées et le sélecteur masqué. Désactivée pour tous les arrière-plans aujourd'hui.
   */
  lockedColors?: boolean;
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
    /** Couleurs de l'ambiance animée (propres au décor, non modifiables). */
    glow: string;
    glow2: string;
  };
};

export const BACKGROUNDS: Record<BackgroundId, BackgroundDefinition> = {
  gala: {
    id: "gala",
    label: { fr: "Gala Premium", he: "גאלה פרימיום" },
    tagline: { fr: "Noir profond et or, pour les grandes soirées", he: "שחור עמוק וזהב, לערבי גאלה" },
    dark: true,
    display: "serif",
    ambient: "sparkles",
    lockedColors: false,
    vars: {
      bg: "#07060a",
      bg2: "#2a1d07",
      text: "#fbf4e2",
      muted: "rgba(251, 244, 226, 0.62)",
      accent: "#e4b65c",
      accent2: "#fff0c2",
      panel: "rgba(18, 14, 8, 0.66)",
      panelBorder: "rgba(228, 182, 92, 0.32)",
      track: "rgba(255, 255, 255, 0.12)",
      qrCard: "#fffaf0",
      glow: "#e4b65c",
      glow2: "#fff0c2",
    },
  },
  velours: {
    id: "velours",
    label: { fr: "Rideau de velours", he: "וילון קטיפה" },
    tagline: { fr: "La scène, son rideau rouge et le projecteur", he: "הבמה, הווילון האדום והזרקור" },
    dark: true,
    display: "serif",
    ambient: "dust",
    lockedColors: false,
    vars: {
      bg: "#14040a",
      bg2: "#5c0f1f",
      text: "#fff4e6",
      muted: "rgba(255, 244, 230, 0.66)",
      accent: "#f2c46d",
      accent2: "#fff1c9",
      panel: "rgba(26, 6, 12, 0.74)",
      panelBorder: "rgba(242, 196, 109, 0.36)",
      track: "rgba(255, 255, 255, 0.13)",
      qrCard: "#fffaf0",
      glow: "#ffe2a8",
      glow2: "#fff6e0",
    },
  },
  artdeco: {
    id: "artdeco",
    label: { fr: "Art déco", he: "ארט דקו" },
    tagline: { fr: "Éventails dorés et lignes des Années folles", he: "מניפות זהב וקווים בסגנון שנות העשרים" },
    dark: true,
    display: "serif",
    ambient: "glints",
    lockedColors: false,
    vars: {
      bg: "#0a0e19",
      bg2: "#1d2436",
      text: "#f8f1e0",
      muted: "rgba(248, 241, 224, 0.64)",
      accent: "#d9b25f",
      accent2: "#f7e3a8",
      panel: "rgba(10, 13, 22, 0.78)",
      panelBorder: "rgba(217, 178, 95, 0.42)",
      track: "rgba(255, 255, 255, 0.12)",
      qrCard: "#fffaf0",
      glow: "#e9c97c",
      glow2: "#fff3cf",
    },
  },
  marbre: {
    id: "marbre",
    label: { fr: "Marbre et or", he: "שיש וזהב" },
    tagline: { fr: "Marbre ivoire veiné d'or, raffiné et lumineux", he: "שיש בגוון שנהב עם עורקי זהב, מעודן ובהיר" },
    dark: false,
    display: "serif",
    ambient: "sheen",
    lockedColors: false,
    vars: {
      bg: "#f4efe6",
      bg2: "#e3d6bd",
      text: "#2b2418",
      muted: "rgba(43, 36, 24, 0.62)",
      accent: "#a8781e",
      accent2: "#e2bd62",
      panel: "rgba(255, 252, 246, 0.84)",
      panelBorder: "rgba(168, 120, 30, 0.3)",
      track: "rgba(43, 36, 24, 0.1)",
      qrCard: "#ffffff",
      glow: "#fffaf0",
      glow2: "#f3dc97",
    },
  },
  jerusalem: {
    id: "jerusalem",
    label: { fr: "Nuit sur Jérusalem", he: "לילה בירושלים" },
    tagline: { fr: "Ciel étoilé au-dessus des remparts dorés", he: "שמי כוכבים מעל החומות המוזהבות" },
    dark: true,
    display: "serif",
    ambient: "stars",
    lockedColors: false,
    vars: {
      bg: "#060a20",
      bg2: "#1d2250",
      text: "#fdf6e3",
      muted: "rgba(253, 246, 227, 0.64)",
      accent: "#f2c55c",
      accent2: "#fff0c4",
      panel: "rgba(8, 12, 34, 0.72)",
      panelBorder: "rgba(242, 197, 92, 0.34)",
      track: "rgba(255, 255, 255, 0.13)",
      qrCard: "#ffffff",
      glow: "#fff4d6",
      glow2: "#f2c55c",
    },
  },
  royal: {
    id: "royal",
    label: { fr: "Bleu royal", he: "כחול מלכותי" },
    tagline: { fr: "Bleu profond et motif géométrique, solennel", he: "כחול עמוק ודוגמה גאומטרית, חגיגי" },
    dark: true,
    display: "serif",
    ambient: "glints",
    lockedColors: false,
    vars: {
      bg: "#0a1f66",
      bg2: "#14329c",
      text: "#f4f7ff",
      muted: "rgba(244, 247, 255, 0.66)",
      accent: "#f4c95d",
      accent2: "#fff0c0",
      panel: "rgba(6, 18, 64, 0.72)",
      panelBorder: "rgba(244, 201, 93, 0.34)",
      track: "rgba(255, 255, 255, 0.14)",
      qrCard: "#ffffff",
      glow: "#f4c95d",
      glow2: "#dfe8ff",
    },
  },
  emeraude: {
    id: "emeraude",
    label: { fr: "Émeraude", he: "אזמרגד" },
    tagline: { fr: "Vert émeraude satiné et ornements dorés", he: "ירוק אזמרגד משיי ועיטורי זהב" },
    dark: true,
    display: "serif",
    ambient: "sparkles",
    lockedColors: false,
    vars: {
      bg: "#032a20",
      bg2: "#06553e",
      text: "#f3fbf6",
      muted: "rgba(243, 251, 246, 0.64)",
      accent: "#e8c46a",
      accent2: "#fff1c4",
      panel: "rgba(2, 30, 22, 0.7)",
      panelBorder: "rgba(232, 196, 106, 0.34)",
      track: "rgba(255, 255, 255, 0.13)",
      qrCard: "#ffffff",
      glow: "#e8c46a",
      glow2: "#fff1c4",
    },
  },
  aurore: {
    id: "aurore",
    label: { fr: "Aurore boréale", he: "זוהר צפוני" },
    tagline: { fr: "Voiles de lumière sur un ciel polaire", he: "וילונות של אור בשמי הקוטב" },
    dark: true,
    display: "sans",
    ambient: "aurora",
    lockedColors: false,
    vars: {
      bg: "#03101f",
      bg2: "#0b3a4a",
      text: "#f0fbff",
      muted: "rgba(240, 251, 255, 0.66)",
      accent: "#6ff2c1",
      accent2: "#c7a6ff",
      panel: "rgba(3, 16, 31, 0.7)",
      panelBorder: "rgba(111, 242, 193, 0.3)",
      track: "rgba(255, 255, 255, 0.13)",
      qrCard: "#ffffff",
      glow: "#4fe3b0",
      glow2: "#a78bfa",
    },
  },
  feerie: {
    id: "feerie",
    label: { fr: "Féerie", he: "קסם" },
    tagline: { fr: "Violet nuit et étoiles, pour l'enfance et le rêve", he: "סגול לילה וכוכבים, לילדות ולחלומות" },
    dark: true,
    display: "sans",
    ambient: "stars",
    lockedColors: false,
    vars: {
      bg: "#0f0628",
      bg2: "#5a1aa8",
      text: "#ffffff",
      muted: "rgba(255, 255, 255, 0.66)",
      accent: "#ffcf3f",
      accent2: "#ff6bd0",
      panel: "rgba(26, 10, 62, 0.66)",
      panelBorder: "rgba(255, 207, 63, 0.3)",
      track: "rgba(255, 255, 255, 0.14)",
      qrCard: "#ffffff",
      glow: "#ffcf3f",
      glow2: "#ff9be3",
    },
  },
  feux: {
    id: "feux",
    label: { fr: "Feux d'artifice", he: "זיקוקים" },
    tagline: { fr: "Ciel de fête et gerbes de lumière, pour célébrer", he: "שמי חג ומטחי אור, לחגוג יחד" },
    dark: true,
    display: "sans",
    ambient: "sparkles",
    lockedColors: false,
    vars: {
      bg: "#0b0820",
      bg2: "#2a1450",
      text: "#fff8f0",
      muted: "rgba(255, 248, 240, 0.66)",
      accent: "#ffd166",
      accent2: "#ff9ec8",
      panel: "rgba(14, 10, 36, 0.72)",
      panelBorder: "rgba(255, 209, 102, 0.32)",
      track: "rgba(255, 255, 255, 0.14)",
      qrCard: "#ffffff",
      glow: "#ffd166",
      glow2: "#7fe3ff",
    },
  },
  sunset: {
    id: "sunset",
    label: { fr: "Coucher de soleil", he: "שקיעה" },
    tagline: { fr: "Dégradé chaleureux, du violet à l'or", he: "מעבר צבעים חם, מסגול לזהב" },
    dark: true,
    display: "sans",
    ambient: "bokeh",
    lockedColors: false,
    vars: {
      bg: "#1a0a33",
      bg2: "#6b1f6e",
      text: "#fff7ef",
      muted: "rgba(255, 247, 239, 0.7)",
      accent: "#ffc35a",
      accent2: "#ff8f9e",
      panel: "rgba(36, 10, 48, 0.7)",
      panelBorder: "rgba(255, 195, 90, 0.36)",
      track: "rgba(255, 255, 255, 0.15)",
      qrCard: "#ffffff",
      glow: "#ffc06e",
      glow2: "#ff8f9e",
    },
  },
  nature: {
    id: "nature",
    label: { fr: "Nature", he: "טבע" },
    tagline: { fr: "Vert profond et lumière, pour les causes durables", he: "ירוק עמוק ואור, למטרות בנות קיימא" },
    dark: true,
    display: "serif",
    ambient: "bokeh",
    lockedColors: false,
    vars: {
      bg: "#03150d",
      bg2: "#155c34",
      text: "#f2fbe8",
      muted: "rgba(242, 251, 232, 0.64)",
      accent: "#a6e35f",
      accent2: "#eefaa0",
      panel: "rgba(4, 28, 17, 0.66)",
      panelBorder: "rgba(166, 227, 95, 0.3)",
      track: "rgba(255, 255, 255, 0.12)",
      qrCard: "#ffffff",
      glow: "#a6e35f",
      glow2: "#eefaa0",
    },
  },
  moderne: {
    id: "moderne",
    label: { fr: "Moderne", he: "מודרני" },
    tagline: { fr: "Lumineux, bleu et blanc, très lisible", he: "בהיר, כחול ולבן, קריא במיוחד" },
    dark: false,
    display: "sans",
    ambient: "rays",
    lockedColors: false,
    vars: {
      bg: "#f1f6ff",
      bg2: "#bcd4ff",
      text: "#0a1d44",
      muted: "rgba(10, 29, 68, 0.6)",
      accent: "#1f5fe0",
      accent2: "#57a2ff",
      panel: "rgba(255, 255, 255, 0.82)",
      panelBorder: "rgba(31, 95, 224, 0.16)",
      track: "rgba(10, 29, 68, 0.1)",
      qrCard: "#ffffff",
      glow: "#1f5fe0",
      glow2: "#57a2ff",
    },
  },
  minimal: {
    id: "minimal",
    label: { fr: "Minimaliste", he: "מינימליסטי" },
    tagline: { fr: "Épuré, typographique, sans artifice", he: "נקי וטיפוגרפי, בלי קישוטים" },
    dark: false,
    display: "sans",
    ambient: "none",
    lockedColors: false,
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
      glow: "#e0482d",
      glow2: "#ff8a6b",
    },
  },
};

/** Liste ordonnée de la bibliothèque (Studio, création d'événement, page d'accueil). */
export const BACKGROUND_LIST: BackgroundDefinition[] = THEME_IDS.map((id) => BACKGROUNDS[id]);

/** Ancien nom de la bibliothèque (les arrière-plans s'appelaient « styles de show »). */
export const THEMES = BACKGROUNDS;

export function getBackground(id: string | null | undefined): BackgroundDefinition {
  return BACKGROUNDS[id as BackgroundId] ?? BACKGROUNDS.gala;
}

/** Valeur CSS `background` du décor de l'arrière-plan (dégradés et SVG inline). */
export function backgroundScene(id: BackgroundId): string {
  return sceneBackground(getBackground(id).id);
}

/** Variables CSS que fournit chaque arrière-plan au show. */
export const SHOW_CSS_VARS = [
  "--show-bg",
  "--show-bg2",
  "--show-text",
  "--show-muted",
  "--show-accent",
  "--show-accent2",
  "--show-panel",
  "--show-panel-border",
  "--show-track",
  "--show-qr-card",
  "--show-glow",
  "--show-glow2",
  "--show-display",
] as const;

/**
 * Variables CSS effectives du show : palette de l'arrière-plan + couleurs personnalisées
 * des éléments (accent, texte). Les anciennes configurations qui contiennent encore une
 * couleur de fond sont acceptées, mais cette couleur est ignorée.
 */
export function themeCssVars(config: { theme: ShowConfig["theme"]; colors: Partial<Record<string, string | null>> }): Record<(typeof SHOW_CSS_VARS)[number], string> {
  const theme = getBackground(config.theme);
  const v = { ...theme.vars };
  if (!theme.lockedColors) {
    if (config.colors.accent) v.accent = config.colors.accent;
    if (config.colors.text) {
      v.text = config.colors.text;
      v.muted = hexToRgba(config.colors.text, 0.62);
    }
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
    "--show-glow": v.glow,
    "--show-glow2": v.glow2,
    "--show-display":
      theme.display === "serif" ? "var(--font-playfair), var(--font-frank), Georgia, serif" : "var(--font-sans), sans-serif",
  };
}

export function hexToRgba(hex: string, alpha: number) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
}
