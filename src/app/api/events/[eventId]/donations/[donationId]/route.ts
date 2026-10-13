import { after } from "next/server";
import { errorResponse, json } from "@/lib/api";
import { assertEventAccess } from "@/lib/dal";
import { deleteDonation, updateDonation } from "@/lib/donations";
import { flushOutbox } from "@/lib/live/server";
import { updateDonationSchema } from "@/lib/validation";

/** Correction d'une promesse (historisée dans le journal d'audit). */
export async function PATCH(request: Request, ctx: RouteContext<"/api/events/[eventId]/donations/[donationId]">) {
  try {
    const { eventId, donationId } = await ctx.params;
    const { user, event } = await assertEventAccess(eventId, "event.regie");
    const body = updateDonationSchema.parse(await request.json());
    const result = await updateDonation({
      donationId,
      eventId,
      actorId: user.id,
      organizationId: event.organizationId,
      ...body,
    });
    after(() => flushOutbox(eventId).catch(() => undefined));
    return json({ ok: true, total: result.total, count: result.count });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/events/[eventId]/donations/[donationId]">) {
  try {
    const { eventId, donationId } = await ctx.params;
    const { user, event } = await assertEventAccess(eventId, "event.regie");
    const totals = await deleteDonation({ donationId, eventId, actorId: user.id, organizationId: event.organizationId });
    after(() => flushOutbox(eventId).catch(() => undefined));
    return json({ ok: true, ...totals });
  } catch (error) {
    return errorResponse(error);
  }
}
