import "server-only";
import { prisma } from "./prisma";
import { checkGoLive, type BillingRefusal } from "./billing";
import { canTransition } from "./lifecycle";
import { appendOutbox, flushOutbox, lockEvent } from "./live/server";
import { audit } from "./audit";
import type { EventStatusCode } from "./constants";

export class LifecycleError extends Error {
  constructor(public reason: "TRANSITION" | "NOT_FOUND" | BillingRefusal) {
    super(reason);
  }
}

/**
 * Change le statut d'un événement selon le cycle de vie (src/lib/lifecycle.ts).
 * Passage en direct : consomme le crédit (une seule fois) et efface les promesses de test,
 * pour que le gala démarre à zéro. Transaction verrouillée sur l'événement.
 */
export async function changeEventStatus(input: { eventId: string; to: EventStatusCode; actorId: string; isSuperAdmin: boolean }) {
  const result = await prisma.$transaction(async (tx) => {
    await lockEvent(tx, input.eventId);
    const event = await tx.event.findUnique({
      where: { id: input.eventId },
      select: {
        status: true,
        creditConsumedAt: true,
        organizationId: true,
        organization: { select: { status: true, subscription: { select: { id: true, plan: true, status: true, eventCredits: true, currentPeriodEnd: true } } } },
      },
    });
    if (!event) throw new LifecycleError("NOT_FOUND");
    if (!canTransition(event.status, input.to, input.isSuperAdmin)) throw new LifecycleError("TRANSITION");

    let consumedCredit = false;
    let purgedTest = 0;
    const now = new Date();

    if (input.to === "LIVE") {
      const sub = event.organization.subscription;
      const check = checkGoLive(sub, event.organization.status === "ACTIVE", Boolean(event.creditConsumedAt), now);
      if (!check.allowed && !input.isSuperAdmin) throw new LifecycleError(check.reason);
      if (check.allowed && check.consumesCredit && sub) {
        // Décrément atomique : impossible de passer sous zéro en cas d'actions simultanées.
        const updated = await tx.subscription.updateMany({ where: { id: sub.id, eventCredits: { gt: 0 } }, data: { eventCredits: { decrement: 1 } } });
        if (updated.count === 0) throw new LifecycleError("NO_CREDITS");
        consumedCredit = true;
      }
      if (event.status === "TEST" || event.status === "DRAFT") {
        // Le vrai gala démarre à zéro : les promesses de test sont effacées.
        purgedTest = (await tx.donation.deleteMany({ where: { eventId: input.eventId, isTest: true } })).count;
      }
    }

    const agg = await tx.donation.aggregate({ where: { eventId: input.eventId, deletedAt: null }, _sum: { amount: true }, _count: { _all: true } });
    await tx.event.update({
      where: { id: input.eventId },
      data: {
        status: input.to,
        liveTotal: agg._sum.amount ?? 0,
        liveCount: agg._count._all,
        ...(input.to === "LIVE"
          ? { startedAt: now, endedAt: null, creditConsumedAt: event.creditConsumedAt ?? now, ...(event.status !== "ENDED" ? { liveControl: {} } : {}) }
          : {}),
        ...(input.to === "ENDED" ? { endedAt: now } : {}),
      },
    });
    await appendOutbox(tx, input.eventId, { type: "event.updated" });
    await audit(tx, {
      organizationId: event.organizationId,
      actorId: input.actorId,
      action: `event.status.${input.to}`,
      entityType: "Event",
      entityId: input.eventId,
      metadata: { from: event.status, consumedCredit, purgedTest },
    });
    return { from: event.status, consumedCredit, purgedTest };
  });
  await flushOutbox(input.eventId).catch(() => undefined);
  return result;
}

/** Efface les promesses de test (en préparation ou en test) sans changer de statut. */
export async function clearTestDonations(input: { eventId: string; actorId: string }) {
  const count = await prisma.$transaction(async (tx) => {
    await lockEvent(tx, input.eventId);
    const event = await tx.event.findUniqueOrThrow({ where: { id: input.eventId }, select: { status: true, organizationId: true } });
    if (event.status !== "TEST" && event.status !== "DRAFT") throw new LifecycleError("TRANSITION");
    const { count } = await tx.donation.deleteMany({ where: { eventId: input.eventId, isTest: true } });
    const agg = await tx.donation.aggregate({ where: { eventId: input.eventId, deletedAt: null }, _sum: { amount: true }, _count: { _all: true } });
    await tx.event.update({ where: { id: input.eventId }, data: { liveTotal: agg._sum.amount ?? 0, liveCount: agg._count._all } });
    await appendOutbox(tx, input.eventId, { type: "event.updated" });
    await audit(tx, { organizationId: event.organizationId, actorId: input.actorId, action: "event.test.clear", entityType: "Event", entityId: input.eventId, metadata: { count } });
    return count;
  });
  await flushOutbox(input.eventId).catch(() => undefined);
  return count;
}

/** Informations nécessaires à la confirmation du passage en direct. */
export async function getGoLiveInfo(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      creditConsumedAt: true,
      organization: { select: { status: true, subscription: { select: { plan: true, status: true, eventCredits: true, currentPeriodEnd: true } } } },
      _count: { select: { donations: { where: { isTest: true } } } },
    },
  });
  if (!event) return null;
  const sub = event.organization.subscription;
  return {
    check: checkGoLive(sub, event.organization.status === "ACTIVE", Boolean(event.creditConsumedAt)),
    credits: sub?.eventCredits ?? 0,
    testDonations: event._count.donations,
  };
}
