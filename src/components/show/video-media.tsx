"use client";

import { memo, useEffect, useRef, useState } from "react";
import { chromeBand, embedUrl, parseVideoSource, type EmbedSource } from "@/lib/show/media";
import { cn } from "@/lib/utils";

type Box = { width: number; height: number };

/**
 * Lecteur vidéo du show : fichier (MP4 / WebM) ou intégration YouTube / Vimeo / Dailymotion.
 * Objectif : uniquement l'image de la vidéo, sans aucune interface de la plateforme.
 */
export const VideoMedia = memo(function VideoMedia({
  url,
  muted = true,
  loop = true,
  fit = "cover",
  box,
  className,
}: {
  url: string | null;
  muted?: boolean;
  loop?: boolean;
  fit?: "cover" | "contain";
  /** Dimensions (px de la surface 1920×1080) de la zone d'affichage. */
  box: Box;
  className?: string;
}) {
  const source = parseVideoSource(url);
  if (!source) return null;
  if (source.kind === "file") return <FileVideo src={source.src} muted={muted} loop={loop} fit={fit} className={className} />;
  const src = embedUrl(source, { muted, loop, origin: typeof window === "undefined" ? undefined : window.location.origin });
  // Clé = URL : le rideau se referme si la vidéo change.
  return <EmbedVideo key={src} src={src} source={source} muted={muted} fit={fit} box={box} className={className} />;
});

function FileVideo({ src, muted, loop, fit, className }: { src: string; muted: boolean; loop: boolean; fit: "cover" | "contain"; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = muted;
    video.play().catch(() => {
      // Lecture avec son refusée par le navigateur : on relance en muet plutôt que de rester figé.
      video.muted = true;
      void video.play().catch(() => undefined);
    });
  }, [muted, src]);
  return (
    <video
      ref={ref}
      src={src}
      className={cn("pointer-events-none size-full", fit === "cover" ? "object-cover" : "object-contain", className)}
      autoPlay
      muted={muted}
      loop={loop}
      playsInline
      preload="auto"
      disablePictureInPicture
      disableRemotePlayback
      controls={false}
    />
  );
}

const PLATFORM_ORIGINS = ["https://www.youtube-nocookie.com", "https://www.youtube.com", "https://player.vimeo.com", "https://www.dailymotion.com", "https://geo.dailymotion.com"];

function EmbedVideo({
  src,
  source,
  muted,
  fit,
  box,
  className,
}: {
  src: string;
  source: EmbedSource;
  muted: boolean;
  fit: "cover" | "contain";
  box: Box;
  className?: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [playing, setPlaying] = useState(false);

  // Rideau : levé dès que la plateforme signale la lecture (ou après un délai de sécurité).
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!PLATFORM_ORIGINS.includes(event.origin) || event.source !== frame.current?.contentWindow) return;
      let data: unknown = event.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      const d = data as { event?: string; info?: { playerState?: number } | number; method?: string };
      const youtubePlaying = (d.event === "infoDelivery" && typeof d.info === "object" && d.info?.playerState === 1) || (d.event === "onStateChange" && d.info === 1);
      const vimeoPlaying = d.event === "play" || d.event === "playProgress" || d.event === "timeupdate";
      if (youtubePlaying || vimeoPlaying) setPlaying(true);
    };
    window.addEventListener("message", onMessage);
    const fallback = window.setTimeout(() => setPlaying(true), source.kind === "dailymotion" ? 2500 : 6000);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(fallback);
    };
  }, [source.kind]);

  const subscribe = () => {
    const win = frame.current?.contentWindow;
    if (!win) return;
    if (source.kind === "youtube") {
      // Protocole de l'API IFrame : demande l'envoi des changements d'état.
      const ping = () => win.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), "*");
      ping();
      window.setTimeout(ping, 700);
      window.setTimeout(ping, 1800);
    } else if (source.kind === "vimeo") {
      for (const value of ["play", "playProgress", "timeupdate"]) win.postMessage(JSON.stringify({ method: "addEventListener", value }), "https://player.vimeo.com");
    }
  };

  // Dimension du lecteur 16:9 selon le cadrage, puis agrandissement pour rogner
  // les bandeaux d'interface (titre en haut, logo en bas) hors du cadre visible.
  const ratio = 16 / 9;
  let width = box.width;
  let height = box.height;
  if (fit === "cover") {
    if (box.width / box.height > ratio) height = box.width / ratio;
    else width = box.height * ratio;
  } else if (box.width / box.height > ratio) width = box.height * ratio;
  else height = box.width / ratio;
  const band = chromeBand(source, muted);
  const zoom = band > 0 ? (height + band * 2) / height : 1;

  return (
    <div className={cn("pointer-events-none relative size-full select-none overflow-hidden", className)} aria-hidden>
      <iframe
        ref={frame}
        src={src}
        title="video"
        tabIndex={-1}
        onLoad={subscribe}
        allow="autoplay; encrypted-media"
        referrerPolicy="strict-origin-when-cross-origin"
        className="pointer-events-none absolute left-1/2 top-1/2 border-0"
        style={{ width: width * zoom, height: height * zoom, maxWidth: "none", transform: "translate(-50%, -50%)" }}
      />
      {/* Rideau aux couleurs du show : masque l'écran de chargement (titre, bouton lecture). */}
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{ background: "var(--show-bg, #000)", opacity: playing ? 0 : 1 }}
      />
    </div>
  );
}
