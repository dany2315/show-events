import "server-only";
import { prisma } from "./prisma";
import { computeBreakdown, computeTotals } from "./live/server";

export type AdminDonation = {
  id: string;
  donorName: string;
  firstName: string | null;
  lastName: string | null;
  isAnonymous: boolean;
  amount: number;
  isFictitious: boolean;
  isTest: boolean;
  source: "MANUAL" | "MOBILE";
  createdAt: string;
  createdByName: string | null;
};

/** Coordonnées du donateur : réservées aux administrateurs (fiche événement, export CSV). */
export type AdminDonationWithContact = AdminDonation & { phone: string | null; email: string | null };

export type RegieState = {
  total: number;
  count: number;
  realTotal: number;
  realCount: number;
  fictitiousTotal: number;
  fictitiousCount: number;
  donations: AdminDonation[];
};

const donationSelect = {
  id: true,
  donorName: true,
  firstName: true,
  lastName: true,
  isAnonymous: true,
  amount: true,
  isFictitious: true,
  isTest: true,
  source: true,
  createdAt: true,
  createdBy: { select: { name: true } },
} as const;

type Row = {
  id: string;
  donorName: string;
  firstName: string | null;
  lastName: string | null;
  isAnonymous: boolean;
  amount: number;
  isFictitious: boolean;
  isTest: boolean;
  source: "MANUAL" | "MOBILE";
  createdAt: Date;
  createdBy: { name: string } | null;
};

function toAdminDonation(r: Row): AdminDonation {
  return {
    id: r.id,
    donorName: r.donorName,
    firstName: r.firstName,
    lastName: r.lastName,
    isAnonymous: r.isAnonymous,
    amount: r.amount,
    isFictitious: r.isFictitious,
    isTest: r.isTest,
    source: r.source,
    createdAt: r.createdAt.toISOString(),
    createdByName: r.createdBy?.name ?? null,
  };
}

/**
 * Vue Régie (administrateurs et Utilisateurs Show) : distingue réel / fictif (jamais exposé au public).
 * Ne contient jamais le téléphone ni l'e-mail des donateurs.
 */
export async function getRegieState(eventId: string, limit = 60): Promise<RegieState> {
  const [totals, breakdown, rows] = await Promise.all([
    computeTotals(prisma, eventId),
    computeBreakdown(eventId),
    prisma.donation.findMany({ where: { eventId, deletedAt: null }, orderBy: { createdAt: "desc" }, take: limit, select: donationSelect }),
  ]);
  return { ...totals, ...breakdown, donations: rows.map(toAdminDonation) };
}

/** Liste des promesses avec coordonnées : à n'appeler que derrière un contrôle « administrateur ». */
export async function getAdminDonations(eventId: string, limit = 500): Promise<AdminDonationWithContact[]> {
  const rows = await prisma.donation.findMany({
    where: { eventId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { ...donationSelect, phone: true, email: true },
  });
  return rows.map((r) => ({ ...toAdminDonation(r), phone: r.phone, email: r.email }));
}
