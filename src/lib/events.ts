import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import { checkEventCreation, isSubscriptionPlan, type EventCreationCheck } from "./billing";
import { defaultShowConfig, normalizeShowConfig, type ThemeId } from "./show/config";
import { ensureEventAccesses } from "./event-access";
import { audit } from "./audit";
import type { AppLocale, CurrencyCode } from "./constants";

export async function getEventCreationCheck(organizationId: string): Promise<EventCreationCheck & { credits: number; subscriptionPlan: boolean }> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { status: true, subscription: { select: { plan: true, status: true, eventCredits: true, currentPeriodEnd: true } } },
  });
  const check = checkEventCreation(org?.subscription ?? null, org?.status === "ACTIVE");
  return {
    ...check,
    credits: org?.subscription?.eventCredits ?? 0,
    subscriptionPlan: org?.subscription ? isSubscriptionPlan(org.subscription.plan) : false,
  };
}

export class EventCreationError extends Error {
  constructor(public reason: string) {
    super(reason);
  }
}

export async function createEvent(input: {
  organizationId: string;
  actorId: string;
  name: string;
  date: Date;
  goalAmount: number;
  currency: CurrencyCode;
  locale: AppLocale;
  templateId?: string | null;
  theme?: ThemeId | null;
  isSuperAdmin?: boolean;
}) {
  const event = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.findUniqueOrThrow({
      where: { id: input.organizationId },
      select: { status: true, subscription: { select: { plan: true, status: true, eventCredits: true, currentPeriodEnd: true } } },
    });
    // Créer un événement est gratuit : le crédit est consommé au passage en direct.
    const check = checkEventCreation(org.subscription, org.status === "ACTIVE");
    if (!check.allowed && !input.isSuperAdmin) throw new EventCreationError(check.reason);

    let config = defaultShowConfig(input.theme ?? "gala");
    if (input.templateId) {
      const template = await tx.showTemplate.findFirst({
        where: { id: input.templateId, organizationId: input.organizationId },
        select: { config: true },
      });
      if (template) config = normalizeShowConfig(template.config);
    }

    const created = await tx.event.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        date: input.date,
        goalAmount: input.goalAmount,
        currency: input.currency,
        locale: input.locale,
        layout: { create: { config: config as unknown as Prisma.InputJsonValue } },
      },
      select: { id: true },
    });
    await audit(tx, {
      organizationId: input.organizationId,
      actorId: input.actorId,
      action: "event.create",
      entityType: "Event",
      entityId: created.id,
      metadata: { name: input.name },
    });
    return created;
  });
  await ensureEventAccesses(event.id);
  return event;
}
