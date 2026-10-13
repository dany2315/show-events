import { prisma } from "@/lib/prisma";

const HEADERS = {
  "cache-control": "public, max-age=31536000, immutable",
  "x-content-type-options": "nosniff",
  "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  "accept-ranges": "bytes",
};

/**
 * Diffusion publique des médias (logos, fonds, vidéos) visibles sur l'écran et le formulaire.
 * Contenu immuable. Gère les requêtes partielles (Range) : Safari / iPhone ne lit pas
 * une vidéo sans elles.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/media/[id]">) {
  const { id } = await ctx.params;
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return new Response("Not found", { status: 404 });
  const asset = await prisma.mediaAsset.findUnique({ where: { id }, select: { data: true, mimeType: true } });
  if (!asset) return new Response("Not found", { status: 404 });
  const bytes = new Uint8Array(asset.data);
  const size = bytes.byteLength;

  const range = request.headers.get("range");
  const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
  if (match && (match[1] !== "" || match[2] !== "")) {
    let start = match[1] === "" ? size - Number(match[2]) : Number(match[1]);
    let end = match[1] === "" || match[2] === "" ? size - 1 : Number(match[2]);
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { ...HEADERS, "content-range": `bytes */${size}` } });
    }
    return new Response(bytes.slice(start, end + 1), {
      status: 206,
      headers: {
        ...HEADERS,
        "content-type": asset.mimeType,
        "content-range": `bytes ${start}-${end}/${size}`,
        "content-length": String(end - start + 1),
      },
    });
  }

  return new Response(bytes, {
    headers: { ...HEADERS, "content-type": asset.mimeType, "content-length": String(size) },
  });
}
