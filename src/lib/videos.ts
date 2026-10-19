import "server-only";
import { prisma } from "./prisma";
import { parseVideoSource } from "./show/media";

/** Vidéo préparée d'un événement (intermèdes lancés depuis la Régie). */
export type EventVideoItem = { id: string; title: string; url: string };

export async function listEventVideos(eventId: string): Promise<EventVideoItem[]> {
  return prisma.eventVideo.findMany({
    where: { eventId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, url: true },
  });
}

/**
 * Une source vidéo est acceptée si le lecteur du show la reconnaît et, pour un fichier
 * importé sur la plateforme, s'il s'agit bien d'une vidéo de la même association.
 */
export async function isAllowedVideoSource(organizationId: string, url: string) {
  const source = parseVideoSource(url);
  if (!source) return false;
  const media = /^\/api\/media\/([a-z0-9]+)$/i.exec(url.trim());
  if (!media) return true;
  const asset = await prisma.mediaAsset.findUnique({ where: { id: media[1] }, select: { organizationId: true, mimeType: true } });
  return Boolean(asset && asset.organizationId === organizationId && asset.mimeType.startsWith("video/"));
}
