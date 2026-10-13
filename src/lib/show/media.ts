/**
 * Sources vidéo acceptées sur le show : fichier (MP4 / WebM importé ou lien https),
 * YouTube ou Vimeo (intégrés en lecture automatique, muette par défaut).
 */
export type VideoSource =
  | { kind: "file"; src: string }
  | { kind: "youtube"; id: string }
  | { kind: "vimeo"; id: string };

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
  if (/\.(mp4|webm|mov|m4v)$/i.test(parsed.pathname) || host.endsWith(".blob.vercel-storage.com")) {
    return { kind: "file", src: parsed.toString() };
  }
  return null;
}

function isYoutubeId(id: string) {
  return /^[A-Za-z0-9_-]{11}$/.test(id);
}

/** URL d'intégration en lecture automatique (les navigateurs imposent le son coupé pour l'autoplay). */
export function embedUrl(source: Extract<VideoSource, { kind: "youtube" | "vimeo" }>, opts: { muted: boolean; loop: boolean }) {
  const mute = opts.muted ? 1 : 0;
  const loop = opts.loop ? 1 : 0;
  if (source.kind === "youtube") {
    const params = new URLSearchParams({
      autoplay: "1",
      mute: String(mute),
      loop: String(loop),
      playlist: source.id,
      controls: "0",
      modestbranding: "1",
      playsinline: "1",
      rel: "0",
      iv_load_policy: "3",
      disablekb: "1",
    });
    return `https://www.youtube-nocookie.com/embed/${source.id}?${params}`;
  }
  const params = new URLSearchParams({
    autoplay: "1",
    muted: String(mute),
    loop: String(loop),
    autopause: "0",
    controls: "0",
    title: "0",
    byline: "0",
    portrait: "0",
    dnt: "1",
  });
  return `https://player.vimeo.com/video/${source.id}?${params}`;
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
