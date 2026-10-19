"use client";

import { useEffect, useState } from "react";
import { Clapperboard } from "lucide-react";
import type { LiveVideo } from "@/lib/live/types";
import type { StageSize } from "@/lib/show/config";
import { parseVideoSource } from "@/lib/show/media";
import { cn } from "@/lib/utils";
import { VideoMedia } from "./video-media";

export type VideoReport = "ended" | "soundBlocked" | "soundOk";

/**
 * Intermède vidéo plein écran, au-dessus de la scène (et de ses surimpressions).
 *  - « screen » (écran géant) : son selon la régie, si l'écran a été « armé » par un clic ;
 *    fin de lecture et son bloqué signalés à la régie.
 *  - « preview » (aperçu de la Régie) : toujours muet ; visuel fixe sur appareil peu puissant.
 */
export function VideoInterlude({
  video,
  leaving,
  stage,
  mode,
  audioArmed,
  lowPower,
  label,
  onEnded,
  onReport,
}: {
  video: LiveVideo;
  leaving: boolean;
  stage: StageSize;
  mode: "screen" | "preview";
  /** Nombre de gestes de l'utilisateur sur l'écran (0 : le navigateur refusera le son). */
  audioArmed: number;
  lowPower: boolean;
  label: string;
  onEnded: (runId: string) => void;
  onReport?: (runId: string, report: VideoReport) => void;
}) {
  // Son refusé par le navigateur malgré un geste : on attend un nouveau geste pour réessayer.
  const [blockedAt, setBlockedAt] = useState<number | null>(null);
  // Lecteur intégré bloqué avec le son : rechargé en muet (le son est ensuite rétabli par l'API).
  const [reloads, setReloads] = useState(0);
  const blocked = blockedAt !== null && blockedAt === audioArmed;
  const wantSound = mode === "screen" && !video.muted;
  const muted = !wantSound || audioArmed === 0 || blocked || leaving;

  // Signalement de l'état du son à la régie (l'état serveur sert de dédoublonnage).
  useEffect(() => {
    if (mode !== "screen" || !onReport || leaving) return;
    if (wantSound && (audioArmed === 0 || blocked)) {
      if (!video.soundBlocked) onReport(video.id, "soundBlocked");
    } else if (video.soundBlocked) onReport(video.id, "soundOk");
  }, [mode, onReport, leaving, wantSound, audioArmed, blocked, video.soundBlocked, video.id]);

  const preview = mode === "preview";
  return (
    <div
      data-video-interlude={video.id}
      data-video-state={leaving ? "leaving" : "playing"}
      data-video-muted={muted ? "true" : "false"}
      className={cn("absolute inset-0 z-50 overflow-hidden bg-black transition-opacity duration-700", leaving ? "opacity-0" : "animate-in fade-in duration-700")}
      style={{ width: stage.width, height: stage.height }}
    >
      {preview && lowPower ? (
        <div className="flex size-full flex-col items-center justify-center gap-6 text-white/85">
          <Clapperboard style={{ width: 160, height: 160 }} strokeWidth={1.2} />
          <div className="max-w-[80%] truncate text-center font-semibold" style={{ fontSize: 72 }}>
            {video.title ?? label}
          </div>
        </div>
      ) : (
        <VideoMedia
          key={reloads}
          url={video.source}
          muted={muted}
          loop={false}
          fit="contain"
          box={stage}
          seekFrom={video.startedAt}
          onEnded={() => {
            onEnded(video.id);
            if (mode === "screen") onReport?.(video.id, "ended");
          }}
          onAudioBlocked={() => {
            if (mode !== "screen") return;
            setBlockedAt(audioArmed);
            // Le fichier repasse seul en muet ; un lecteur intégré bloqué doit être rechargé.
            if (parseVideoSource(video.source)?.kind !== "file") setReloads((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
