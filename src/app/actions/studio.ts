"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { AccessError, assertEventAccess, assertOrgAccess } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { appendOutbox, flushOutbox, lockEvent } from "@/lib/live/server";
import { normalizeShowConfig, showConfigSchema } from "@/lib/show/config";
import { audit } from "@/lib/audit";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof AccessError) return { ok: false, error: "ACCESS" };
  if (error instanceof z.ZodError) return { ok: false, error: "INVALID" };
  console.error("[studio]", error);
  return { ok: false, error: "SERVER" };
}


/** Enregistre le design du show et le diffuse immédiatement sur les écrans connectés. */
export async function saveLayoutAction(eventId: string, rawConfig: unknown): Promise<Result<{ version: number }>> {
  try {
    const { user, event } = await assertEventAccess(eventId, "event.studio");
    const config = showConfigSchema.parse(normalizeShowConfig(rawConfig));
    const version = await prisma.$transaction(async (tx) => {
      await lockEvent(tx, eventId);
      const layout = await tx.showLayout.upsert({
        where: { eventId },
        create: { eventId, config: config as unknown as Prisma.InputJsonValue },
        update: { config: config as unknown as Prisma.InputJsonValue, version: { increment: 1 } },
        select: { version: true },
      });
      await appendOutbox(tx, eventId, { type: "layout.updated", version: layout.version });
      return layout.version;
    });
    await flushOutbox(eventId).catch(() => undefined);
    await audit(prisma, { organizationId: event.organizationId, actorId: user.id, action: "layout.save", entityType: "Event", entityId: eventId });
    return { ok: true, version };
  } catch (error) {
    return fail(error);
  }
}

export async function saveTemplateAction(eventId: string, name: string, rawConfig: unknown): Promise<Result<{ id: string; name: string }>> {
  try {
    const { user, event } = await assertEventAccess(eventId, "event.studio");
    const cleanName = z.string().trim().min(1).max(60).parse(name);
    const config = showConfigSchema.parse(normalizeShowConfig(rawConfig));
    const template = await prisma.showTemplate.create({
      data: { organizationId: event.organizationId, name: cleanName, config: config as unknown as Prisma.InputJsonValue, createdById: user.id },
      select: { id: true, name: true },
    });
    revalidatePath(`/o/${event.organization.slug}/templates`);
    return { ok: true, ...template };
  } catch (error) {
    return fail(error);
  }
}

export async function renameTemplateAction(templateId: string, name: string): Promise<Result> {
  try {
    const template = await prisma.showTemplate.findUnique({ where: { id: templateId }, select: { organizationId: true } });
    if (!template) return { ok: false, error: "NOT_FOUND" };
    const { org } = await assertOrgAccess(template.organizationId, "org.view");
    await prisma.showTemplate.update({ where: { id: templateId }, data: { name: z.string().trim().min(1).max(60).parse(name) } });
    revalidatePath(`/o/${org.slug}/templates`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteTemplateAction(templateId: string): Promise<Result> {
  try {
    const template = await prisma.showTemplate.findUnique({ where: { id: templateId }, select: { organizationId: true } });
    if (!template) return { ok: false, error: "NOT_FOUND" };
    const { org } = await assertOrgAccess(template.organizationId, "org.view");
    await prisma.showTemplate.delete({ where: { id: templateId } });
    revalidatePath(`/o/${org.slug}/templates`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
