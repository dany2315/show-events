import { after } from "next/server";
import { clientIp, errorResponse, json } from "@/lib/api";
import { recordDonation } from "@/lib/donations";
import { resolveAccessToken } from "@/lib/event-access";
import { flushOutbox } from "@/lib/live/server";
import { hashIp } from "@/lib/tokens";
import { publicDonationSchema } from "@/lib/validation";

/**
 * Formulaire mobile (lien / QR code) : sans compte, sans PIN, sans validation.
 * La promesse est réelle et apparaît immédiatement sur le show.
 * Protections : champ piège, limite de débit par appareil, idempotence.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/d/[token]">) {
  try {
    const { token } = await ctx.params;
    const eventId = await resolveAccessToken(token, "DONATION_FORM");
    if (!eventId) return json({ error: "Lien invalide", code: "UNAVAILABLE" }, { status: 404 });

    const body = publicDonationSchema.parse(await request.json());
    if (body.website) {
      // Robot : on répond comme si tout allait bien, sans rien enregistrer.
      return json({ ok: true, donation: { donorName: body.donorName, amount: body.amount } });
    }

    const result = await recordDonation({
      eventId,
      donorName: body.donorName,
      amount: body.amount,
      isFictitious: false,
      source: "MOBILE",
      idempotencyKey: body.idempotencyKey,
      ipHash: hashIp(clientIp(request)),
    });
    after(() => flushOutbox(eventId).catch(() => undefined));
    return json({
      ok: true,
      duplicate: result.duplicate,
      donation: { donorName: result.donation.donorName, amount: result.donation.amount },
      total: result.total,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
