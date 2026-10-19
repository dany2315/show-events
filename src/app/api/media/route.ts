import { errorResponse, json } from "@/lib/api";
import { assertOrgAccess } from "@/lib/dal";
import { MediaError, storeImage } from "@/lib/media";
import { prisma } from "@/lib/prisma";
import { ALLOWED_VIDEO_TYPES } from "@/lib/constants";
import { DEMO_LIMITS } from "@/lib/demo-mode";

/** Import d'un logo ou d'une image de fond (membres de l'association). */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const organizationId = String(form.get("organizationId") ?? "");
    const file = form.get("file");
    if (!organizationId || !(file instanceof File)) return json({ error: "Fichier manquant" }, { status: 400 });
    const { org } = await assertOrgAccess(organizationId, "event.studio");
    if (org.isDemo) {
      // Espace de démo : images légères uniquement, vidéos par lien.
      if (ALLOWED_VIDEO_TYPES.includes(file.type)) return json({ error: "En démo, les vidéos s'ajoutent par lien.", code: "DEMO" }, { status: 400 });
      if (file.size > DEMO_LIMITS.imageBytes) return json({ error: "En démo, images de 1 Mo maximum.", code: "DEMO" }, { status: 400 });
      if ((await prisma.mediaAsset.count({ where: { organizationId } })) >= DEMO_LIMITS.media) {
        return json({ error: "Limite d'images de la démo atteinte.", code: "DEMO" }, { status: 400 });
      }
    }
    const stored = await storeImage(organizationId, file);
    return json(stored, { status: 201 });
  } catch (error) {
    if (error instanceof MediaError) return json({ error: error.message }, { status: 400 });
    return errorResponse(error);
  }
}
