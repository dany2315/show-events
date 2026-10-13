"use client";

import { memo, useEffect, useRef } from "react";
import { embedUrl, parseVideoSource } from "@/lib/show/media";
import { cn } from "@/lib/utils";

/**
 * Lecteur vidéo du show : fichier (MP4 / WebM) ou intégration YouTube / Vimeo.
 * Lecture automatique ; le son ne peut être activé que si le navigateur l'autorise
 * (sinon la vidéo repart muette plutôt que de rester figée).
 */
export const VideoMedia = memo(function VideoMedia({
  url,
  muted = true,
  loop = true,
  fit = "cover",
  box,
  className,
}: {
  /** Dimensions (px de la surface 1920×1080) de la zone d'affichage. */
  box: { width: number; height: number };
  url: string | null;
  muted?: boolean;
  loop?: boolean;
  fit?: "cover" | "contain";
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const source = parseVideoSource(url);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = muted;
    video.play().catch(() => {
      // Autoplay avec son refusé par le navigateur : on relance en muet.
      video.muted = true;
      void video.play().catch(() => undefined);
    });
  }, [muted, url]);

  if (!source) return null;

  if (source.kind === "file") {
    return (
      <video
        ref={ref}
        src={source.src}
        className={cn("size-full", fit === "cover" ? "object-cover" : "object-contain", className)}
        autoPlay
        muted={muted}
        loop={loop}
        playsInline
        preload="auto"
        disablePictureInPicture
      />
    );
  }

  // Les iframes ne gèrent pas le cadrage : on dimensionne le lecteur 16:9 à partir de la boîte.
  const ratio = 16 / 9;
  let width = box.width;
  let height = box.height;
  if (fit === "cover") {
    if (box.width / box.height > ratio) height = box.width / ratio;
    else width = box.height * ratio;
  } else if (box.width / box.height > ratio) width = box.height * ratio;
  else height = box.width / ratio;
  return (
    <div className={cn("relative size-full overflow-hidden", className)}>
      <iframe
        src={embedUrl(source, { muted, loop })}
        title="video"
        allow="autoplay; encrypted-media; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border-0"
        style={{ width, height, maxWidth: "none" }}
      />
    </div>
  );
});
