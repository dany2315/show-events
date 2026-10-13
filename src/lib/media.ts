import "server-only";
import { ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES, MAX_UPLOAD_BYTES, MAX_VIDEO_UPLOAD_BYTES } from "./constants";
import { prisma } from "./prisma";

/**
 * Stockage des logos et images de fond.
 * MVP : stockage en base (aucune dépendance externe). Le stockage S3 compatible
 * pourra être branché ici (variables S3_*) sans changer les URL publiques.
 */
export class MediaError extends Error {}

function sniffMime(buffer: Buffer, declared: string): string | null {
  const head = buffer.subarray(0, 12);
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return "image/png";
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  if (head.toString("ascii", 0, 4) === "RIFF" && head.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (head.toString("ascii", 0, 3) === "GIF") return "image/gif";
  if (head.toString("ascii", 4, 8) === "ftyp") return "video/mp4";
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return "video/webm";
  if (declared === "image/svg+xml") {
    const text = buffer.toString("utf8", 0, Math.min(buffer.length, 4096)).trimStart().toLowerCase();
    const full = buffer.toString("utf8").toLowerCase();
    if ((text.startsWith("<svg") || text.startsWith("<?xml")) && !full.includes("<script") && !/\son\w+\s*=/.test(full)) {
      return "image/svg+xml";
    }
  }
  return null;
}

export async function storeImage(organizationId: string, file: File) {
  const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
  if (!isVideo && !ALLOWED_IMAGE_TYPES.includes(file.type)) throw new MediaError("Format non pris en charge.");
  if (isVideo && file.size > MAX_VIDEO_UPLOAD_BYTES) throw new MediaError("Vidéo trop volumineuse (4 Mo max).");
  if (!isVideo && file.size > MAX_UPLOAD_BYTES) throw new MediaError("Fichier trop volumineux (2 Mo max).");
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = sniffMime(buffer, file.type);
  if (!mimeType || mimeType.startsWith("video/") !== isVideo) throw new MediaError(isVideo ? "Vidéo invalide." : "Image invalide.");
  const asset = await prisma.mediaAsset.create({
    data: { organizationId, mimeType, size: buffer.length, data: buffer },
    select: { id: true },
  });
  return { id: asset.id, url: `/api/media/${asset.id}` };
}
