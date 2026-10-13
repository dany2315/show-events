import "server-only";
import { prisma } from "./prisma";

export type EventSummary = {
  id: string;
  name: string;
  date: Date;
  status: "DRAFT" | "TEST" | "LIVE" | "ENDED";
  currency: "EUR" | "ILS" | "USD";
  locale: "fr" | "he";
  goalAmount: number;
  total: number;
  count: number;
  theme: string | null;
};

/** Événements d'une association avec leur total (toutes promesses, réelles et fictives). */
export async function listOrgEvents(organizationId: string): Promise<EventSummary[]> {
  const events = await prisma.event.findMany({
    where: { organizationId },
    orderBy: { date: "desc" },
    select: {
      id: true,
      name: true,
      date: true,
      status: true,
      currency: true,
      locale: true,
      goalAmount: true,
      layout: { select: { config: true } },
    },
  });
  if (events.length === 0) return [];
  const sums = await prisma.donation.groupBy({
    by: ["eventId"],
    where: { eventId: { in: events.map((e) => e.id) }, deletedAt: null },
    _sum: { amount: true },
    _count: { _all: true },
  });
  const byId = new Map(sums.map((s) => [s.eventId, s]));
  return events.map(({ layout, ...e }) => ({
    ...e,
    total: byId.get(e.id)?._sum.amount ?? 0,
    count: byId.get(e.id)?._count._all ?? 0,
    theme: (layout?.config as { theme?: string } | null)?.theme ?? null,
  }));
}

/** Événement à mettre en avant : en direct, sinon le prochain, sinon le dernier. */
export function pickFeaturedEvent(events: EventSummary[], now = new Date()) {
  const live = events.find((e) => e.status === "LIVE");
  if (live) return { event: live, kind: "current" as const };
  const testing = events.find((e) => e.status === "TEST");
  if (testing) return { event: testing, kind: "current" as const };
  const upcoming = events
    .filter((e) => e.status !== "ENDED" && e.date.getTime() >= now.getTime() - 12 * 3600_000)
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0];
  if (upcoming) return { event: upcoming, kind: "next" as const };
  if (events[0]) return { event: events[0], kind: "last" as const };
  return null;
}
