import { z } from "zod";
import { errorResponse, json } from "@/lib/api";
import { assertEventAccess } from "@/lib/dal";
import { resolveAccessToken } from "@/lib/event-access";
import { createSubscribeTokenRequest, isAblyConfigured } from "@/lib/live/ably";
import { channelName } from "@/lib/live/types";

const bodySchema = z.union([z.object({ displayToken: z.string().min(10).max(80) }), z.object({ eventId: z.string().min(5).max(40) })]);

/**
 * Délivre un jeton Ably limité à l'abonnement du canal d'un seul événement.
 * Sans clé Ably, répond { enabled: false } : le client reste en synchronisation HTTP.
 */
export async function POST(request: Request) {
  try {
    if (!isAblyConfigured()) return json({ enabled: false });
    const body = bodySchema.parse(await request.json());
    let eventId: string | null;
    if ("displayToken" in body) {
      eventId = await resolveAccessToken(body.displayToken, "DISPLAY");
      if (!eventId) return json({ error: "Lien invalide" }, { status: 404 });
    } else {
      await assertEventAccess(body.eventId, "event.screen");
      eventId = body.eventId;
    }
    const channel = channelName(eventId);
    const tokenRequest = await createSubscribeTokenRequest(channel);
    return json({ enabled: true, channel, tokenRequest });
  } catch (error) {
    return errorResponse(error);
  }
}
