"use server";

import { z } from "zod";
import { AccessError, assertEventAccess } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { MAX_EVENT_VIDEOS, videoTitleSchema, videoUrlSchema } from "@/lib/live/video";
import { isAllowedVideoSource, listEventVideos, type EventVideoItem } from "@/lib/videos";

/**
 * Vidéos préparées pour les intermèdes du direct : mêmes droits que le pilotage de la Régie.
 * Chaque action renvoie la liste à jour (ordre d'affichage).
 */
export type VideoActionResult = { ok: true; videos: EventVideoItem[] } | { ok: false; error: "ACCESS" | "INVALID" | "VIDEO_SOURCE" | "LIMIT" | "NOT_FOUND" | "SERVER" };

function fail(error: unknown): VideoActionResult {
  if (error instanceof AccessError) return { ok: false, error: "ACCESS" };
  if (error instanceof z.ZodError) {
    return { ok: false, error: error.issues.some((i) => i.message === "VIDEO_SOURCE") ? "VIDEO_SOURCE" : "INVALID" };
  }
  console.error("[videos]", error);
  return { ok: false, error: "SERVER" };
}

const addSchema = z.object({ title: videoTitleSchema, url: videoUrlSchema });

export async function addVideoAction(eventId: string, input: { title: string; url: string }): Promise<VideoActionResult> {
  try {
    const { user, event } = await assertEventAccess(eventId, "event.regie");
    const data = addSchema.parse(input);
    if (!(await isAllowedVideoSource(event.organizationId, data.url))) return { ok: false, error: "VIDEO_SOURCE" };
    const created = await prisma.$transaction(async (tx) => {
      const existing = await tx.eventVideo.aggregate({ where: { eventId }, _count: { _all: true }, _max: { position: true } });
      if (existing._count._all >= MAX_EVENT_VIDEOS) return null;
      return tx.eventVideo.create({ data: { eventId, title: data.title, url: data.url, position: (existing._max.position ?? -1) + 1 }, select: { id: true } });
    });
    if (!created) return { ok: false, error: "LIMIT" };
    await audit(prisma, { organizationId: event.organizationId, actorId: user.id, action: "video.add", entityType: "EventVideo", entityId: created.id, metadata: { eventId } });
    return { ok: true, videos: await listEventVideos(eventId) };
  } catch (error) {
    return fail(error);
  }
}

export async function renameVideoAction(eventId: string, videoId: string, title: string): Promise<VideoActionResult> {
  try {
    const { user, event } = await assertEventAccess(eventId, "event.regie");
    const clean = videoTitleSchema.parse(title);
    const { count } = await prisma.eventVideo.updateMany({ where: { id: videoId, eventId }, data: { title: clean } });
    if (count === 0) return { ok: false, error: "NOT_FOUND" };
    await audit(prisma, { organizationId: event.organizationId, actorId: user.id, action: "video.rename", entityType: "EventVideo", entityId: videoId, metadata: { eventId } });
    return { ok: true, videos: await listEventVideos(eventId) };
  } catch (error) {
    return fail(error);
  }
}

/** Nouvel ordre complet de la liste (identifiants de toutes les vidéos de l'événement). */
export async function reorderVideosAction(eventId: string, ids: string[]): Promise<VideoActionResult> {
  try {
    const { user, event } = await assertEventAccess(eventId, "event.regie");
    const order = z.array(z.string().min(1).max(64)).max(MAX_EVENT_VIDEOS).parse(ids);
    const current = await prisma.eventVideo.findMany({ where: { eventId }, select: { id: true } });
    const known = new Set(current.map((v) => v.id));
    if (order.length !== known.size || new Set(order).size !== order.length || !order.every((id) => known.has(id))) {
      return { ok: false, error: "INVALID" };
    }
    await prisma.$transaction(order.map((id, position) => prisma.eventVideo.update({ where: { id }, data: { position } })));
    await audit(prisma, { organizationId: event.organizationId, actorId: user.id, action: "video.reorder", entityType: "Event", entityId: eventId });
    return { ok: true, videos: await listEventVideos(eventId) };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteVideoAction(eventId: string, videoId: string): Promise<VideoActionResult> {
  try {
    const { user, event } = await assertEventAccess(eventId, "event.regie");
    const { count } = await prisma.eventVideo.deleteMany({ where: { id: videoId, eventId } });
    if (count === 0) return { ok: false, error: "NOT_FOUND" };
    await audit(prisma, { organizationId: event.organizationId, actorId: user.id, action: "video.delete", entityType: "EventVideo", entityId: videoId, metadata: { eventId } });
    return { ok: true, videos: await listEventVideos(eventId) };
  } catch (error) {
    return fail(error);
  }
}
