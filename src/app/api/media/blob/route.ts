import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { errorResponse, json } from "@/lib/api";
import { assertOrgAccess } from "@/lib/dal";
import { ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES, MAX_BLOB_UPLOAD_BYTES } from "@/lib/constants";

/**
 * Envoi direct navigateur → Vercel Blob des fichiers lourds (vidéos, GIF), sans passer
 * par la limite de taille des fonctions. Actif uniquement si BLOB_READ_WRITE_TOKEN est défini.
 * Le jeton d'envoi n'est délivré qu'aux membres de l'association (droit Studio).
 */
export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return json({ error: "Stockage vidéo non configuré" }, { status: 501 });
  try {
    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const { organizationId } = JSON.parse(clientPayload ?? "{}") as { organizationId?: string };
        if (!organizationId) throw new Error("Association manquante");
        const { org } = await assertOrgAccess(organizationId, "event.studio");
        // Espace de démo : aucun envoi de fichier lourd.
        if (org.isDemo) throw new Error("Indisponible en démo");
        return {
          allowedContentTypes: [...ALLOWED_IMAGE_TYPES.filter((t) => t !== "image/svg+xml"), ...ALLOWED_VIDEO_TYPES],
          maximumSizeInBytes: MAX_BLOB_UPLOAD_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ organizationId }),
        };
      },
    });
    return json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
