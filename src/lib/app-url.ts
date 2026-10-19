import "server-only";
import { headers } from "next/headers";

/** URL publique de l'application, déduite de la requête (fiable derrière Vercel) ou de l'environnement. */
export async function getAppUrl() {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch {
    // hors contexte de requête
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
