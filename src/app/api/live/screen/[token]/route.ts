import { after } from "next/server";
import { errorResponse, json } from "@/lib/api";
import { getEventLinks, resolveAccessToken } from "@/lib/event-access";
import { buildSnapshot, eventsSince, flushOutbox } from "@/lib/live/server";
import { isAblyConfigured } from "@/lib/live/ably";

/** Synchronisation de l'écran géant (lien de diffusion public, non devinable). */
export async function GET(request: Request, ctx: RouteContext<"/api/live/screen/[token]">) {
  try {
    const { token } = await ctx.params;
    const eventId = await resolveAccessToken(token, "DISPLAY");
    if (!eventId) return json({ error: "Lien invalide" }, { status: 404 });

    const getFormUrl = async () => (await getEventLinks(eventId)).formUrl;
    const afterParam = new URL(request.url).searchParams.get("after");

    if (isAblyConfigured()) after(() => flushOutbox(eventId).catch(() => undefined));

    if (afterParam !== null) {
      const since = Number.parseInt(afterParam, 10);
      const result = await eventsSince(eventId, Number.isFinite(since) ? since : 0, getFormUrl);
      return result ? json(result) : json({ error: "Introuvable" }, { status: 404 });
    }
    const snapshot = await buildSnapshot(eventId, await getFormUrl());
    return snapshot ? json(snapshot) : json({ error: "Introuvable" }, { status: 404 });
  } catch (error) {
    return errorResponse(error);
  }
}
