import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import { checkEventCreation, type EventCreationCheck } from "./billing";
import { defaultShowConfig, normalizeShowConfig, type ThemeId } from "./show/config";
import { ensureEventAccesses } from "./event-access";
import { audit } from "./audit";
import type { AppLocale, CurrencyCode } from "./constants";

export async function getEventCreationCheck(organizationId: string): Promise<EventCreationCheck & { credits: number }> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { status: true, subscription: { select: { plan: true, status: true, eventCredits: true, currentPeriodEnd: true } } },
  });
  const check = checkEventCreation(org?.subscription ?? null, org?.status === "ACTIVE");
  return { ...check, credits: org?.subscription?.eventCredits ?? 0 };
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
      select: { status: true, subscription: { select: { id: true, plan: true, status: true, eventCredits: true, currentPeriodEnd: true } } },
    });
    const check = checkEventCreation(org.subscription, org.status === "ACTIVE");
    if (!check.allowed && !input.isSuperAdmin) throw new EventCreationError(check.reason);
    if (check.allowed && check.consumesCredit && org.subscription) {
      // Décrément atomique : impossible de passer sous zéro en cas de créations simultanées.
      const updated = await tx.subscription.updateMany({
        where: { id: org.subscription.id, eventCredits: { gt: 0 } },
        data: { eventCredits: { decrement: 1 } },
      });
      if (updated.count === 0 && !input.isSuperAdmin) throw new EventCreationError("NO_CREDITS");
    }

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
      metadata: { name: input.name, consumedCredit: check.allowed && check.consumesCredit },
    });
    return created;
  });
  await ensureEventAccesses(event.id);
  return event;
}
