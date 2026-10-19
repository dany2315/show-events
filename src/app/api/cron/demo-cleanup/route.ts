import { json } from "@/lib/api";
import { cleanupExpiredDemoSpaces } from "@/lib/demo";
import { isDemoMode } from "@/lib/demo-mode";
import { safeEqual } from "@/lib/tokens";

/**
 * Nettoyage quotidien des espaces de démo de plus de 24 h (tâche planifiée Vercel, voir vercel.json).
 * Vercel envoie `Authorization: Bearer <CRON_SECRET>`. Hors mode démo, la route n'existe pas (404).
 */
export async function GET(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!isDemoMode()) return json({ error: "Not found" }, { status: 404 });
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(authorization, `Bearer ${secret}`)) return json({ error: "Unauthorized" }, { status: 401 });
  const result = await cleanupExpiredDemoSpaces();
  return json({ ok: true, ...result });
}
