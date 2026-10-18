import { after } from "next/server";
import { errorResponse, json } from "@/lib/api";
import { assertEventAccess } from "@/lib/dal";
import { recordDonation } from "@/lib/donations";
import { flushOutbox } from "@/lib/live/server";
import { getRegieState } from "@/lib/regie";
import { manualDonationSchema } from "@/lib/validation";

/** État de la régie (promesses avec indicateur réel / fictif). */
export async function GET(_request: Request, ctx: RouteContext<"/api/events/[eventId]/donations">) {
  try {
    const { eventId } = await ctx.params;
    await assertEventAccess(eventId, "event.regie");
    return json(await getRegieState(eventId));
  } catch (error) {
    return errorResponse(error);
  }
}

/** Saisie manuelle depuis la Régie Live (administrateur ou Utilisateur Show). */
export async function POST(request: Request, ctx: RouteContext<"/api/events/[eventId]/donations">) {
  try {
    const { eventId } = await ctx.params;
    const { user } = await assertEventAccess(eventId, "event.regie");
    const body = manualDonationSchema.parse(await request.json());
    const result = await recordDonation({
      eventId,
      firstName: body.firstName ?? null,
      lastName: body.lastName ?? null,
      phone: body.phone ?? null,
      email: body.email ?? null,
      anonymous: body.anonymous,
      amount: body.amount,
      isFictitious: body.isFictitious,
      source: "MANUAL",
      idempotencyKey: body.idempotencyKey,
      createdById: user.id,
    });
    after(() => flushOutbox(eventId).catch(() => undefined));
    return json(
      {
        ok: true,
        duplicate: result.duplicate,
        donation: {
          id: result.donation.id,
          donorName: result.donation.donorName,
          amount: result.donation.amount,
          isFictitious: result.donation.isFictitious,
        },
        total: result.total,
        count: result.count,
      },
      { status: result.duplicate ? 200 : 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
