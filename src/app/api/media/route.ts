import { errorResponse, json } from "@/lib/api";
import { assertOrgAccess } from "@/lib/dal";
import { MediaError, storeImage } from "@/lib/media";

/** Import d'un logo ou d'une image de fond (membres de l'association). */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const organizationId = String(form.get("organizationId") ?? "");
    const file = form.get("file");
    if (!organizationId || !(file instanceof File)) return json({ error: "Fichier manquant" }, { status: 400 });
    await assertOrgAccess(organizationId, "event.studio");
    const stored = await storeImage(organizationId, file);
    return json(stored, { status: 201 });
  } catch (error) {
    if (error instanceof MediaError) return json({ error: error.message }, { status: 400 });
    return errorResponse(error);
  }
}
