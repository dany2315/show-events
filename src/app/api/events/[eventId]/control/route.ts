import { after } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { errorResponse, json } from "@/lib/api";
import { assertEventAccess } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { appendOutbox, flushOutbox, lockEvent, parseControl } from "@/lib/live/server";
import type { LiveCommand } from "@/lib/live/types";
import { controlSchema } from "@/lib/validation";

/** Pilotage du show depuis la régie : pause, message à l'écran, célébrations. */
export async function POST(request: Request, ctx: RouteContext<"/api/events/[eventId]/control">) {
  try {
    const { eventId } = await ctx.params;
    await assertEventAccess(eventId, "event.regie");
    const body = controlSchema.parse(await request.json());

    const control = await prisma.$transaction(async (tx) => {
      await lockEvent(tx, eventId);
      const event = await tx.event.findUniqueOrThrow({ where: { id: eventId }, select: { liveControl: true } });
      const current = parseControl(event.liveControl);
      let command: LiveCommand | null = null;
      switch (body.action) {
        case "pause":
          current.paused = true;
          break;
        case "resume":
          current.paused = false;
          break;
        case "overlay":
          current.overlay = body.message?.trim() || null;
          current.overlayAt = new Date().toISOString();
          break;
        case "clearOverlay":
          current.overlay = null;
          current.overlayAt = null;
          break;
        case "celebrate":
          command = "celebrate";
          break;
        case "goal":
          command = "goal";
          break;
      }
      await tx.event.update({ where: { id: eventId }, data: { liveControl: current as unknown as Prisma.InputJsonValue } });
      await appendOutbox(tx, eventId, { type: "control", control: current, command });
      return current;
    });

    after(() => flushOutbox(eventId).catch(() => undefined));
    return json({ ok: true, control });
  } catch (error) {
    return errorResponse(error);
  }
}
