import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import { checkEventCreation, isSubscriptionPlan, type EventCreationCheck } from "./billing";
import { defaultShowConfig, normalizeShowConfig, type ThemeId } from "./show/config";
import { ensureEventAccesses } from "./event-access";
import { audit } from "./audit";
import type { AppLocale, CurrencyCode } from "./constants";
import { MAX_CATEGORIES, type CategoryInput } from "./categories";
import { hideCategoriesBlock, revealCategoriesBlock } from "./show/categories-layout";

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

type Tx = Prisma.TransactionClient;

/**
 * Enregistre les catégories de donateurs d'un événement (au plus 3) : mises à jour, ajouts, retraits.
 * Une catégorie retirée est supprimée ; ses promesses restent, sans catégorie.
 * Le bloc « Catégories » de l'écran apparaît avec la première catégorie et disparaît avec la dernière.
 */
export async function syncEventCategories(tx: Tx, eventId: string, inputs: CategoryInput[], locale: AppLocale) {
  const existing = await tx.donorCategory.findMany({ where: { eventId }, select: { id: true, name: true } });
  // Une catégorie envoyée sans identifiant mais du même nom qu'une existante la met à jour
  // (formulaire renvoyé deux fois) : ses promesses gardent leur catégorie.
  inputs = inputs.map((c) => (c.id ? c : { ...c, id: existing.find((e) => e.name.toLowerCase() === c.name.toLowerCase())?.id }));
  const keep = new Set(inputs.map((c) => c.id).filter((id): id is string => Boolean(id && existing.some((e) => e.id === id))));
  await tx.donorCategory.deleteMany({ where: { eventId, id: { notIn: [...keep] } } });
  for (const [position, c] of inputs.slice(0, MAX_CATEGORIES).entries()) {
    if (c.id && keep.has(c.id)) await tx.donorCategory.update({ where: { id: c.id }, data: { name: c.name, color: c.color, position } });
    else await tx.donorCategory.create({ data: { eventId, name: c.name, color: c.color, position } });
  }
  const hadCategories = existing.length > 0;
  const hasCategories = Math.min(inputs.length, MAX_CATEGORIES) > 0;
  if (hadCategories === hasCategories) return false;
  const layout = await tx.showLayout.findUnique({ where: { eventId }, select: { config: true } });
  if (!layout) return false;
  const current = normalizeShowConfig(layout.config);
  const next = hasCategories ? revealCategoriesBlock(current, locale === "he") : hideCategoriesBlock(current);
  await tx.showLayout.update({ where: { eventId }, data: { config: next as unknown as Prisma.InputJsonValue, version: { increment: 1 } } });
  return true;
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
  categories?: CategoryInput[];
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
    // Modèle venant d'un événement avec catégories : le bloc n'a pas lieu d'être sans catégorie.
    if (!input.categories?.length) config = hideCategoriesBlock(config);

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
    if (input.categories?.length) await syncEventCategories(tx, created.id, input.categories, input.locale);
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
