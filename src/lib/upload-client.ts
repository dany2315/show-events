import { ALLOWED_VIDEO_TYPES, MAX_BLOB_UPLOAD_BYTES, MAX_UPLOAD_BYTES, MAX_VIDEO_UPLOAD_BYTES } from "./constants";

export class UploadTooLargeError extends Error {
  constructor(public maxBytes: number) {
    super("too-large");
  }
}

/**
 * Envoie un média (logo, fond, vidéo) et retourne son URL publique.
 *  - Petits fichiers : stockés par la plateforme (/api/media/…).
 *  - Fichiers lourds : envoi direct vers Vercel Blob si le stockage est activé.
 */
export async function uploadImage(organizationId: string, file: File, opts: { blobEnabled?: boolean } = {}): Promise<string> {
  const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
  const localMax = isVideo ? MAX_VIDEO_UPLOAD_BYTES : MAX_UPLOAD_BYTES;

  if (file.size > localMax) {
    if (!opts.blobEnabled) throw new UploadTooLargeError(localMax);
    if (file.size > MAX_BLOB_UPLOAD_BYTES) throw new UploadTooLargeError(MAX_BLOB_UPLOAD_BYTES);
    const { upload } = await import("@vercel/blob/client");
    const safeName = file.name.replace(/[^\w.-]+/g, "-").slice(-80) || "media";
    const blob = await upload(`orgs/${organizationId}/${safeName}`, file, {
      access: "public",
      handleUploadUrl: "/api/media/blob",
      clientPayload: JSON.stringify({ organizationId }),
      multipart: file.size > 20 * 1024 * 1024,
    });
    return blob.url;
  }

  const body = new FormData();
  body.set("organizationId", organizationId);
  body.set("file", file);
  const res = await fetch("/api/media", { method: "POST", body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "upload");
  return data.url as string;
}

export function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024 ? `${Math.round(bytes / (1024 * 1024))} Mo` : `${Math.round(bytes / 1024)} Ko`;
}
