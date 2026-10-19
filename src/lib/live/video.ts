import { z } from "zod";
import { parseVideoSource } from "../show/media";
import type { LiveVideo } from "./types";

/** Nombre maximal de vidéos préparées par événement. */
export const MAX_EVENT_VIDEOS = 20;
export const MAX_VIDEO_TITLE_LENGTH = 80;
export const MAX_VIDEO_URL_LENGTH = 2048;

/** Titre d'une vidéo (liste des vidéos préparées, lancement d'un lien en direct). */
export const videoTitleSchema = z.string().trim().min(1).max(MAX_VIDEO_TITLE_LENGTH);

/** Source d'une vidéo : uniquement les liens reconnus par le lecteur du show. */
export const videoUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_VIDEO_URL_LENGTH)
  .refine((value) => parseVideoSource(value) !== null, { message: "VIDEO_SOURCE" });

const liveVideoSchema = z.object({
  id: z.string().min(1).max(64),
  source: z.string().min(1).max(MAX_VIDEO_URL_LENGTH),
  title: z.string().max(MAX_VIDEO_TITLE_LENGTH).nullable().catch(null),
  refId: z.string().max(64).nullable().catch(null),
  startedAt: z.string().min(1),
  muted: z.boolean().catch(false),
  soundBlocked: z.boolean().catch(false),
  startTotal: z.number().int().catch(0),
  startCount: z.number().int().catch(0),
});

/** Intermède vidéo stocké dans `Event.liveControl` : null si absent ou invalide (source non reconnue). */
export function parseLiveVideo(value: unknown): LiveVideo | null {
  const parsed = liveVideoSchema.safeParse(value);
  if (!parsed.success || !parseVideoSource(parsed.data.source)) return null;
  return parsed.data;
}

/** Identifiant d'un lancement de vidéo (non devinable, sans dépendance serveur). */
export function newVideoRunId() {
  return (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).replace(/-/g, "").slice(0, 24);
}

/**
 * Récapitulatif affiché au retour sur la scène : promesses arrivées pendant l'intermède.
 * Null si aucune nouvelle promesse (ou si des suppressions compensent les ajouts).
 */
export function interludeRecap(video: Pick<LiveVideo, "startTotal" | "startCount">, total: number, count: number) {
  const added = count - video.startCount;
  const amount = total - video.startTotal;
  if (added <= 0 || amount <= 0) return null;
  return { count: added, amount };
}

/** Durée écoulée « m:ss » (ou « h:mm:ss ») depuis le lancement. */
export function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
