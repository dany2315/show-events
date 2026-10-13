import { json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { isAblyConfigured } from "@/lib/live/ably";

/** Vérification avant un gala : base de données et mode temps réel. */
export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return json({ ok: true, database: "up", realtime: isAblyConfigured() ? "ably" : "http-sync", latencyMs: Date.now() - started });
  } catch {
    return json({ ok: false, database: "down" }, { status: 503 });
  }
}
