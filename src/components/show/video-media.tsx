"use client";

import { memo, useEffect, useRef, useState } from "react";
import { chromeBand, embedUrl, parseVideoSource, type EmbedSource } from "@/lib/show/media";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";

type Box = { width: number; height: number };

type PlaybackCallbacks = {
  /** Fin de lecture (fichier : événement « ended » ; YouTube / Vimeo : API postMessage). Jamais appelé en boucle. */
  onEnded?: () => void;
  /** Le navigateur a refusé la lecture avec le son : la vidéo continue en muet. */
  onAudioBlocked?: () => void;
};

/**
 * Lecteur vidéo du show : fichier (MP4 / WebM) ou intégration YouTube / Vimeo / Dailymotion.
 * Objectif : uniquement l'image de la vidéo, sans aucune interface de la plateforme.
 * Le son se coupe / se rétablit sans recharger la vidéo (fichier, YouTube, Vimeo).
 */
export const VideoMedia = memo(function VideoMedia({
  url,
  muted = true,
  loop = true,
  fit = "cover",
  box,
  seekFrom,
  className,
  onEnded,
  onAudioBlocked,
}: {
  url: string | null;
  muted?: boolean;
  loop?: boolean;
  fit?: "cover" | "contain";
  /** Dimensions (px de la surface du show) de la zone d'affichage. */
  box: Box;
  /** Fichier : date ISO du lancement, pour reprendre au bon moment (écran rechargé, aperçu ouvert en cours). */
  seekFrom?: string | null;
  className?: string;
} & PlaybackCallbacks) {
  const source = parseVideoSource(url);
  if (!source) return null;
  if (source.kind === "file") {
    return <FileVideo src={source.src} muted={muted} loop={loop} fit={fit} seekFrom={seekFrom ?? null} className={className} onEnded={onEnded} onAudioBlocked={onAudioBlocked} />;
  }
  // Clé = vidéo : le rideau se referme si la vidéo change. Dailymotion n'expose pas de commande
  // de son : le changement de son y relance le lecteur.
  const key = `${source.kind}:${source.id}:${loop}${source.kind === "dailymotion" ? `:${muted}` : ""}`;
  return <EmbedVideo key={key} source={source} muted={muted} loop={loop} fit={fit} box={box} className={className} onEnded={onEnded} onAudioBlocked={onAudioBlocked} />;
});

/** Dernière version d'un rappel, lisible depuis les gestionnaires d'événements. */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

function FileVideo({
  src,
  muted,
  loop,
  fit,
  seekFrom,
  className,
  onEnded,
  onAudioBlocked,
}: {
  src: string;
  muted: boolean;
  loop: boolean;
  fit: "cover" | "contain";
  seekFrom: string | null;
  className?: string;
} & PlaybackCallbacks) {
  const ref = useRef<HTMLVideoElement>(null);
  const blockedRef = useLatest(onAudioBlocked);
  const endedRef = useLatest(onEnded);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = muted;
    video.play().catch(() => {
      // Lecture avec son refusée par le navigateur : on relance en muet plutôt que de rester figé.
      if (!muted) blockedRef.current?.();
      video.muted = true;
      void video.play().catch(() => undefined);
    });
  }, [muted, src, blockedRef]);

  const onLoadedMetadata = () => {
    const video = ref.current;
    if (!video || !seekFrom || loop) return;
    const elapsed = (Date.now() - Date.parse(seekFrom)) / 1000;
    // Lancement récent : on part du début (délai de diffusion). Sinon, reprise au bon moment.
    if (Number.isFinite(elapsed) && elapsed > 3 && Number.isFinite(video.duration)) video.currentTime = Math.min(elapsed, Math.max(0, video.duration - 0.2));
  };

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
      onLoadedMetadata={onLoadedMetadata}
      onEnded={() => {
        if (!loop) endedRef.current?.();
      }}
    />
  );
}

const PLATFORM_ORIGINS = ["https://www.youtube-nocookie.com", "https://www.youtube.com", "https://player.vimeo.com", "https://www.dailymotion.com", "https://geo.dailymotion.com"];

function EmbedVideo({
  source,
  muted,
  loop,
  fit,
  box,
  className,
  onEnded,
  onAudioBlocked,
}: {
  source: EmbedSource;
  muted: boolean;
  loop: boolean;
  fit: "cover" | "contain";
  box: Box;
  className?: string;
} & PlaybackCallbacks) {
  const frame = useRef<HTMLIFrameElement>(null);
  const hydrated = useHydrated();
  const [playing, setPlaying] = useState(false);
  // Le lecteur est chargé avec l'état du son au montage ; les changements passent ensuite par l'API.
  const [startMuted] = useState(muted);
  const confirmed = useRef(false);
  const ended = useRef(false);
  const endedRef = useLatest(onEnded);
  const blockedRef = useLatest(onAudioBlocked);
  const src = hydrated ? embedUrl(source, { muted: startMuted, loop, origin: window.location.origin }) : null;

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
      const state = d.event === "infoDelivery" && typeof d.info === "object" ? d.info?.playerState : d.event === "onStateChange" && typeof d.info === "number" ? d.info : undefined;
      const youtubePlaying = state === 1;
      const vimeoPlaying = d.event === "play" || d.event === "playProgress" || d.event === "timeupdate";
      if (youtubePlaying || vimeoPlaying) {
        confirmed.current = true;
        setPlaying(true);
      }
      // Fin de lecture (YouTube : état 0 ; Vimeo : « ended »), uniquement après une vraie lecture.
      if (!loop && confirmed.current && !ended.current && (state === 0 || d.event === "ended" || d.event === "finish")) {
        ended.current = true;
        endedRef.current?.();
      }
    };
    window.addEventListener("message", onMessage);
    const fallback = window.setTimeout(() => setPlaying(true), source.kind === "dailymotion" ? 2500 : 6000);
    // Lecture avec son jamais démarrée (YouTube / Vimeo) : le navigateur l'a bloquée.
    const audioCheck =
      !startMuted && source.kind !== "dailymotion"
        ? window.setTimeout(() => {
            if (!confirmed.current) blockedRef.current?.();
          }, 7000)
        : undefined;
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(fallback);
      if (audioCheck) window.clearTimeout(audioCheck);
    };
  }, [source.kind, loop, startMuted, endedRef, blockedRef]);

  // Son coupé / rétabli sans recharger la vidéo (Dailymotion : relancé via la clé du lecteur).
  const mutedRef = useLatest(muted);
  const applied = useRef(startMuted);
  const applyMute = (value: boolean) => {
    const win = frame.current?.contentWindow;
    if (!win || applied.current === value) return;
    applied.current = value;
    if (source.kind === "youtube") {
      win.postMessage(JSON.stringify({ event: "command", func: value ? "mute" : "unMute", args: [] }), "*");
      if (!value) win.postMessage(JSON.stringify({ event: "command", func: "setVolume", args: [100] }), "*");
    } else if (source.kind === "vimeo") {
      win.postMessage(JSON.stringify({ method: "setMuted", value }), "https://player.vimeo.com");
      win.postMessage(JSON.stringify({ method: "setVolume", value: value ? 0 : 1 }), "https://player.vimeo.com");
    }
  };
  const applyMuteRef = useLatest(applyMute);
  useEffect(() => {
    applyMuteRef.current(muted);
  }, [muted, applyMuteRef]);

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
      for (const value of ["play", "playProgress", "timeupdate", "ended"]) win.postMessage(JSON.stringify({ method: "addEventListener", value }), "https://player.vimeo.com");
    }
    // Son modifié avant que le lecteur soit prêt (commande perdue) : le lecteur est dans l'état
    // de son de l'URL, on réapplique l'état voulu.
    window.setTimeout(() => {
      applied.current = startMuted;
      applyMute(mutedRef.current);
    }, 1200);
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
  const band = chromeBand(source, startMuted && loop);
  const zoom = band > 0 ? (height + band * 2) / height : 1;

  return (
    <div className={cn("pointer-events-none relative size-full select-none overflow-hidden", className)} aria-hidden>
      {src && (
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
      )}
      {/* Rideau aux couleurs du show : masque l'écran de chargement (titre, bouton lecture). */}
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{ background: "var(--show-bg, #000)", opacity: playing ? 0 : 1 }}
      />
    </div>
  );
}
