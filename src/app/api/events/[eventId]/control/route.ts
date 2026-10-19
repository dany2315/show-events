import { after } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { errorResponse, json } from "@/lib/api";
import { audit } from "@/lib/audit";
import { assertEventAccess } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { appendOutbox, flushOutbox, lockEvent, parseControl } from "@/lib/live/server";
import type { LiveCommand } from "@/lib/live/types";
import { newVideoRunId } from "@/lib/live/video";
import { parseVideoSource } from "@/lib/show/media";
import { controlSchema } from "@/lib/validation";
import { isAllowedVideoSource } from "@/lib/videos";

class ControlError extends Error {
  constructor(
    public code: "VIDEO_SOURCE" | "VIDEO_NOT_FOUND",
    public status: 400 | 404,
  ) {
    super(code);
  }
}

/** Pilotage du show depuis la régie : pause, message à l'écran, célébrations, intermède vidéo. */
export async function POST(request: Request, ctx: RouteContext<"/api/events/[eventId]/control">) {
  try {
    const { eventId } = await ctx.params;
    const { user, event } = await assertEventAccess(eventId, "event.regie");
    const body = controlSchema.parse(await request.json());

    // Intermède vidéo : la source est résolue et vérifiée avant d'ouvrir la transaction.
    let launch: { source: string; title: string | null; refId: string | null } | null = null;
    if (body.action === "videoStart") {
      if (body.videoId) {
        const video = await prisma.eventVideo.findFirst({ where: { id: body.videoId, eventId }, select: { id: true, title: true, url: true } });
        if (!video) throw new ControlError("VIDEO_NOT_FOUND", 404);
        launch = { source: video.url, title: video.title, refId: video.id };
      } else {
        const url = body.url?.trim() ?? "";
        if (!parseVideoSource(url)) throw new ControlError("VIDEO_SOURCE", 400);
        launch = { source: url, title: body.title?.trim() || null, refId: null };
      }
      if (!(await isAllowedVideoSource(event.organizationId, launch.source))) throw new ControlError("VIDEO_SOURCE", 400);
    }

    const control = await prisma.$transaction(async (tx) => {
      await lockEvent(tx, eventId);
      const row = await tx.event.findUniqueOrThrow({ where: { id: eventId }, select: { liveControl: true, liveTotal: true, liveCount: true } });
      const current = parseControl(row.liveControl);
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
        case "videoStart":
          current.video = {
            id: newVideoRunId(),
            source: launch!.source,
            title: launch!.title,
            refId: launch!.refId,
            startedAt: new Date().toISOString(),
            muted: body.muted ?? false,
            soundBlocked: false,
            startTotal: row.liveTotal,
            startCount: row.liveCount,
          };
          break;
        case "videoMute":
          // Rétablir le son : l'écran signalera de nouveau un éventuel blocage du navigateur.
          if (current.video) current.video = { ...current.video, muted: body.muted ?? !current.video.muted, soundBlocked: false };
          break;
        case "videoStop":
          current.video = null;
          break;
      }
      await tx.event.update({ where: { id: eventId }, data: { liveControl: current as unknown as Prisma.InputJsonValue } });
      await appendOutbox(tx, eventId, { type: "control", control: current, command });
      return current;
    });

    after(() => flushOutbox(eventId).catch(() => undefined));
    if (body.action === "videoStart" || body.action === "videoStop") {
      after(() =>
        audit(prisma, {
          organizationId: event.organizationId,
          actorId: user.id,
          action: body.action === "videoStart" ? "live.video.start" : "live.video.stop",
          entityType: "Event",
          entityId: eventId,
          metadata: body.action === "videoStart" && launch ? { title: launch.title, refId: launch.refId, muted: body.muted ?? false } : undefined,
        }).catch(() => undefined),
      );
    }
    return json({ ok: true, control });
  } catch (error) {
    if (error instanceof ControlError) return json({ error: error.message, code: error.code }, { status: error.status });
    return errorResponse(error);
  }
}
