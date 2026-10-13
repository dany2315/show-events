import "server-only";
import { prisma } from "./prisma";
import { computeBreakdown, computeTotals } from "./live/server";

export type AdminDonation = {
  id: string;
  donorName: string;
  amount: number;
  isFictitious: boolean;
  source: "MANUAL" | "MOBILE";
  createdAt: string;
  createdByName: string | null;
};

export type RegieState = {
  total: number;
  count: number;
  realTotal: number;
  realCount: number;
  fictitiousTotal: number;
  fictitiousCount: number;
  donations: AdminDonation[];
};

/** Vue administrateur : distingue réel / fictif (jamais exposé au public). */
export async function getRegieState(eventId: string, limit = 60): Promise<RegieState> {
  const [totals, breakdown, rows] = await Promise.all([
    computeTotals(prisma, eventId),
    computeBreakdown(eventId),
    prisma.donation.findMany({
      where: { eventId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        donorName: true,
        amount: true,
        isFictitious: true,
        source: true,
        createdAt: true,
        createdBy: { select: { name: true } },
      },
    }),
  ]);
  return {
    ...totals,
    ...breakdown,
    donations: rows.map((r) => ({
      id: r.id,
      donorName: r.donorName,
      amount: r.amount,
      isFictitious: r.isFictitious,
      source: r.source,
      createdAt: r.createdAt.toISOString(),
      createdByName: r.createdBy?.name ?? null,
    })),
  };
}
