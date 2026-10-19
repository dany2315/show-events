"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { AccessError, assertEventAccess, assertOrgAccess } from "@/lib/dal";
import { createEvent, EventCreationError, syncEventCategories } from "@/lib/events";
import { parseCategoriesField } from "@/lib/categories";
import { prisma } from "@/lib/prisma";
import { appendOutbox, flushOutbox, lockEvent } from "@/lib/live/server";
import { rotateAccess } from "@/lib/event-access";
import { changeEventStatus, clearTestDonations, getGoLiveInfo, LifecycleError } from "@/lib/event-lifecycle";
import { audit } from "@/lib/audit";
import { eventInputSchema } from "@/lib/validation";
import { THEME_IDS } from "@/lib/show/config";
import { DEMO_LIMITS } from "@/lib/demo-mode";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string; field?: string };

function fail(error: unknown): ActionResult {
  if (error instanceof AccessError) return { ok: false, error: "ACCESS" };
  if (error instanceof EventCreationError) return { ok: false, error: error.reason };
  if (error instanceof LifecycleError) return { ok: false, error: error.reason };
  if (error instanceof z.ZodError) return { ok: false, error: "INVALID", field: String(error.issues[0]?.path[0] ?? "") };
  console.error("[action]", error);
  return { ok: false, error: "SERVER" };
}

async function notifyScreens(eventId: string) {
  await prisma.$transaction(async (tx) => {
    await lockEvent(tx, eventId);
    await appendOutbox(tx, eventId, { type: "event.updated" });
  });
  await flushOutbox(eventId).catch(() => undefined);
}

export async function createEventAction(organizationId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let target: string;
  try {
    const { user, org } = await assertOrgAccess(organizationId, "event.manage");
    // Espace de démo : nombre d'événements plafonné.
    if (org.isDemo && (await prisma.event.count({ where: { organizationId } })) >= DEMO_LIMITS.events) throw new EventCreationError("DEMO_LIMIT");
    const input = eventInputSchema.parse({
      name: formData.get("name"),
      date: formData.get("date"),
      goalAmount: String(formData.get("goalAmount") ?? "").replace(/[\s  .,]/g, ""),
      currency: formData.get("currency"),
      locale: formData.get("locale"),
      campaignUrl: formData.get("campaignUrl") ?? undefined,
    });
    const start = String(formData.get("start") ?? "theme:gala");
    const [kind, value] = start.split(":");
    const templateId = kind === "template" ? value : null;
    const theme = kind === "theme" && THEME_IDS.includes(value as (typeof THEME_IDS)[number]) ? (value as (typeof THEME_IDS)[number]) : "gala";
    const categories = parseCategoriesField(formData.get("categories"));
    const event = await createEvent({
      organizationId,
      actorId: user.id,
      ...input,
      templateId,
      theme,
      isSuperAdmin: user.platformRole === "SUPER_ADMIN",
      categories,
    });
    target = `/o/${org.slug}/events/${event.id}`;
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/o", "layout");
  redirect(target);
}

const updateSchema = eventInputSchema.extend({ eventId: z.string() });

export async function updateEventAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const input = updateSchema.parse({
      eventId: formData.get("eventId"),
      name: formData.get("name"),
      date: formData.get("date"),
      goalAmount: String(formData.get("goalAmount") ?? "").replace(/[\s  .,]/g, ""),
      currency: formData.get("currency"),
      locale: formData.get("locale"),
      campaignUrl: formData.get("campaignUrl") ?? undefined,
    });
    const categories = parseCategoriesField(formData.get("categories"));
    const { user, event } = await assertEventAccess(input.eventId, "event.manage");
    const hasDonations = (await prisma.donation.count({ where: { eventId: event.id, deletedAt: null } })) > 0;
    await prisma.$transaction(async (tx) => {
      // Verrou de l'événement : les promesses en cours d'écriture voient des catégories cohérentes.
      await lockEvent(tx, event.id);
      await tx.event.update({
        where: { id: event.id },
        data: {
          name: input.name,
          date: input.date,
          goalAmount: input.goalAmount,
          locale: input.locale,
          campaignUrl: input.campaignUrl,
          // La devise est figée dès qu'une promesse existe (montants enregistrés dans cette devise).
          ...(hasDonations ? {} : { currency: input.currency }),
        },
      });
      await syncEventCategories(tx, event.id, categories, input.locale);
    });
    await audit(prisma, { organizationId: event.organizationId, actorId: user.id, action: "event.update", entityType: "Event", entityId: event.id });
    await notifyScreens(event.id);
    revalidatePath(`/o/${event.organization.slug}`, "layout");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function setEventStatusAction(eventId: string, status: "DRAFT" | "TEST" | "LIVE" | "ENDED"): Promise<ActionResult> {
  try {
    const { user, event } = await assertEventAccess(eventId, "event.regie");
    await changeEventStatus({ eventId, to: status, actorId: user.id, isSuperAdmin: user.platformRole === "SUPER_ADMIN" });
    revalidatePath(`/o/${event.organization.slug}`, "layout");
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function clearTestDonationsAction(eventId: string): Promise<ActionResult> {
  try {
    const { user, event } = await assertEventAccess(eventId, "event.regie");
    await clearTestDonations({ eventId, actorId: user.id });
    revalidatePath(`/o/${event.organization.slug}`, "layout");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Informations affichées dans la confirmation « Passer en direct » (crédit, promesses de test). */
export async function getGoLiveInfoAction(eventId: string) {
  try {
    await assertEventAccess(eventId, "event.regie");
    const info = await getGoLiveInfo(eventId);
    return info ? { ok: true as const, ...info } : { ok: false as const, error: "NOT_FOUND" };
  } catch (error) {
    return fail(error) as { ok: false; error: string };
  }
}

export async function setEventLogoAction(eventId: string, logoUrl: string | null): Promise<ActionResult> {
  try {
    const { event } = await assertEventAccess(eventId, "event.studio");
    if (logoUrl && !/^\/api\/media\/[a-z0-9]+$/i.test(logoUrl)) return { ok: false, error: "INVALID" };
    await prisma.event.update({ where: { id: eventId }, data: { logoUrl } });
    await notifyScreens(eventId);
    revalidatePath(`/o/${event.organization.slug}`, "layout");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function rotateAccessAction(eventId: string, type: "DONATION_FORM" | "DISPLAY"): Promise<ActionResult> {
  try {
    const { user, event } = await assertEventAccess(eventId, "event.manage");
    await rotateAccess(eventId, type);
    await audit(prisma, { organizationId: event.organizationId, actorId: user.id, action: "event.access.rotate", entityType: "Event", entityId: eventId, metadata: { type } });
    if (type === "DONATION_FORM") await notifyScreens(eventId); // le QR code de l'écran change
    revalidatePath(`/o/${event.organization.slug}`, "layout");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteEventAction(eventId: string): Promise<ActionResult> {
  let slug: string;
  try {
    const { user, event } = await assertEventAccess(eventId, "event.manage");
    slug = event.organization.slug;
    await prisma.event.delete({ where: { id: eventId } });
    await audit(prisma, {
      organizationId: event.organizationId,
      actorId: user.id,
      action: "event.delete",
      entityType: "Event",
      entityId: eventId,
      metadata: { name: event.name } as Prisma.InputJsonValue,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/o/${slug}`, "layout");
  redirect(`/o/${slug}/events`);
}
