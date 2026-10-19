import { after } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { errorResponse, json } from "@/lib/api";
import { resolveAccessToken } from "@/lib/event-access";
import { prisma } from "@/lib/prisma";
import { appendOutbox, flushOutbox, lockEvent, parseControl } from "@/lib/live/server";
import { screenVideoReportSchema } from "@/lib/validation";

/**
 * Signalements de l'écran géant pendant un intermède vidéo (lien de diffusion) :
 *  - « ended » : la vidéo est terminée, retour automatique à la scène pour tous ;
 *  - « soundBlocked » / « soundOk » : le navigateur de l'écran a refusé (ou accepte) le son.
 * Sans effet si l'intermède signalé n'est plus celui en cours (plusieurs écrans, retards).
 */
export async function POST(request: Request, ctx: RouteContext<"/api/live/screen/[token]/video">) {
  try {
    const { token } = await ctx.params;
    const eventId = await resolveAccessToken(token, "DISPLAY");
    if (!eventId) return json({ error: "Lien invalide" }, { status: 404 });
    const body = screenVideoReportSchema.parse(await request.json());

    const changed = await prisma.$transaction(async (tx) => {
      await lockEvent(tx, eventId);
      const row = await tx.event.findUniqueOrThrow({ where: { id: eventId }, select: { liveControl: true } });
      const current = parseControl(row.liveControl);
      const video = current.video;
      if (!video || video.id !== body.runId) return false;
      if (body.action === "ended") current.video = null;
      else {
        const blocked = body.action === "soundBlocked";
        if (video.soundBlocked === blocked || (blocked && video.muted)) return false;
        current.video = { ...video, soundBlocked: blocked };
      }
      await tx.event.update({ where: { id: eventId }, data: { liveControl: current as unknown as Prisma.InputJsonValue } });
      await appendOutbox(tx, eventId, { type: "control", control: current, command: null });
      return true;
    });

    if (changed) after(() => flushOutbox(eventId).catch(() => undefined));
    return json({ ok: true, changed });
  } catch (error) {
    return errorResponse(error);
  }
}
