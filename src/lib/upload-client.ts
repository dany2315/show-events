/** Envoie une image (logo, fond) et retourne son URL publique /api/media/… */
export async function uploadImage(organizationId: string, file: File): Promise<string> {
  const body = new FormData();
  body.set("organizationId", organizationId);
  body.set("file", file);
  const res = await fetch("/api/media", { method: "POST", body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "upload");
  return data.url as string;
}
