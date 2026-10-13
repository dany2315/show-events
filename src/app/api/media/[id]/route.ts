import { prisma } from "@/lib/prisma";

/** Diffusion publique des images (logos visibles sur l'écran et le formulaire). Contenu immuable. */
export async function GET(_request: Request, ctx: RouteContext<"/api/media/[id]">) {
  const { id } = await ctx.params;
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return new Response("Not found", { status: 404 });
  const asset = await prisma.mediaAsset.findUnique({ where: { id }, select: { data: true, mimeType: true } });
  if (!asset) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(asset.data), {
    headers: {
      "content-type": asset.mimeType,
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
