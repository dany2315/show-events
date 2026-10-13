/**
 * Sources vidéo acceptées sur le show : fichier (MP4 / WebM importé ou lien https),
 * YouTube ou Vimeo (intégrés en lecture automatique, muette par défaut).
 */
export type VideoSource =
  | { kind: "file"; src: string }
  | { kind: "youtube"; id: string }
  | { kind: "vimeo"; id: string }
  | { kind: "dailymotion"; id: string };

export type EmbedSource = Extract<VideoSource, { kind: "youtube" | "vimeo" | "dailymotion" }>;

export function parseVideoSource(url: string | null | undefined): VideoSource | null {
  if (!url) return null;
  const value = url.trim();
  if (/^\/api\/media\/[a-z0-9]+$/i.test(value)) return { kind: "file", src: value };
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  const host = parsed.hostname.replace(/^www\.|^m\./, "");

  if (host === "youtu.be") {
    const id = parsed.pathname.slice(1).split("/")[0];
    return isYoutubeId(id) ? { kind: "youtube", id } : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "music.youtube.com") {
    const id =
      parsed.searchParams.get("v") ??
      parsed.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/)?.[1] ??
      "";
    return isYoutubeId(id) ? { kind: "youtube", id } : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = parsed.pathname.match(/(\d{6,12})/)?.[1];
    return id ? { kind: "vimeo", id } : null;
  }
  if (host === "dailymotion.com" || host === "dai.ly" || host === "geo.dailymotion.com") {
    const id = host === "dai.ly" ? parsed.pathname.slice(1) : (parsed.searchParams.get("video") ?? parsed.pathname.match(/\/(?:embed\/)?video\/([a-zA-Z0-9]+)/)?.[1] ?? "");
    return /^[a-zA-Z0-9]{5,12}$/.test(id) ? { kind: "dailymotion", id } : null;
  }
  if (/\.(mp4|webm|mov|m4v)$/i.test(parsed.pathname) || host.endsWith(".blob.vercel-storage.com")) {
    return { kind: "file", src: parsed.toString() };
  }
  return null;
}

function isYoutubeId(id: string) {
  return /^[A-Za-z0-9_-]{11}$/.test(id);
}

/**
 * URL d'intégration « épurée » : lecture automatique, sans titre, chaîne, logo,
 * sous-titres, annotations, suggestions, commandes ni plein écran.
 * (Les navigateurs imposent le son coupé pour une lecture automatique.)
 */
export function embedUrl(source: EmbedSource, opts: { muted: boolean; loop: boolean; origin?: string }) {
  const mute = opts.muted ? "1" : "0";
  const loop = opts.loop ? "1" : "0";
  if (source.kind === "youtube") {
    const params = new URLSearchParams({
      autoplay: "1",
      mute,
      loop,
      playlist: source.id, // nécessaire pour que « loop » fonctionne sur une vidéo seule
      controls: "0",
      rel: "0",
      fs: "0",
      disablekb: "1",
      iv_load_policy: "3", // pas d'annotations
      cc_load_policy: "0", // pas de sous-titres
      playsinline: "1",
      modestbranding: "1",
      enablejsapi: "1", // pour lever le rideau dès que la lecture commence
      ...(opts.origin ? { origin: opts.origin } : {}),
    });
    return `https://www.youtube-nocookie.com/embed/${source.id}?${params}`;
  }
  if (source.kind === "vimeo") {
    const params = new URLSearchParams({
      autoplay: "1",
      muted: mute,
      loop,
      autopause: "0",
      controls: "0",
      title: "0",
      byline: "0",
      portrait: "0",
      dnt: "1",
      texttrack: "false",
      // Mode arrière-plan : aucune interface. Vimeo l'impose muet.
      ...(opts.muted ? { background: "1" } : {}),
      api: "1",
    });
    return `https://player.vimeo.com/video/${source.id}?${params}`;
  }
  const params = new URLSearchParams({
    autoplay: "1",
    mute,
    loop,
    controls: "0",
    "ui-logo": "0",
    "ui-start-screen-info": "0",
    "queue-enable": "0",
    "queue-autoplay-next": "0",
    "sharing-enable": "0",
    "ui-highlight": "000000",
  });
  return `https://www.dailymotion.com/embed/video/${source.id}?${params}`;
}

/**
 * Bandeaux d'interface (titre en haut, logo / barre en bas) que les plateformes affichent
 * parfois malgré tout : hauteur en px du lecteur, rognée en agrandissant légèrement la vidéo.
 * Vimeo en mode arrière-plan n'affiche rien : aucun rognage.
 */
export function chromeBand(source: EmbedSource, muted: boolean) {
  if (source.kind === "vimeo" && muted) return 0;
  return source.kind === "youtube" ? 64 : 52;
}

/** Images de fond acceptées : fichier importé, ou lien https vers une image / un GIF. */
export function isImageUrl(url: string | null | undefined) {
  if (!url) return false;
  if (/^\/api\/media\/[a-z0-9]+$/i.test(url)) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && (/\.(png|jpe?g|gif|webp|avif|svg)$/i.test(parsed.pathname) || parsed.hostname.endsWith(".blob.vercel-storage.com"));
  } catch {
    return false;
  }
}
