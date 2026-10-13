import "server-only";
import { randomBytes } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import { appendOutbox, computeTotals, lockEvent, toPublicDonation } from "./live/server";
import { MAX_DONATION_AMOUNT, MAX_DONOR_NAME_LENGTH, PUBLIC_RATE_LIMIT } from "./constants";
import { audit } from "./audit";

export class DonationError extends Error {
  constructor(
    public code: "EVENT_NOT_FOUND" | "EVENT_ENDED" | "ORG_SUSPENDED" | "RATE_LIMITED" | "INVALID" | "NOT_FOUND",
    message: string,
  ) {
    super(message);
  }
}

export function sanitizeDonorName(raw: string) {
  return raw
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_DONOR_NAME_LENGTH);
}

export type RecordDonationInput = {
  eventId: string;
  donorName: string;
  amount: number;
  isFictitious: boolean;
  source: "MANUAL" | "MOBILE";
  idempotencyKey?: string | null;
  ipHash?: string | null;
  createdById?: string | null;
};

type InsertedRow = {
  id: string;
  donorName: string;
  amount: number;
  isFictitious: boolean;
  createdAt: Date;
  total: number;
  count: number;
  seq: number;
};

/**
 * Chemin d'une promesse (cahier des charges §13) : vérification → enregistrement → outbox → diffusion.
 *
 * Un seul ordre SQL atomique (un aller-retour réseau) :
 *  1. incrémente les compteurs du direct sur la ligne de l'événement (verrou de ligne : les
 *     promesses d'un même gala sont sérialisées, les totaux diffusés sont strictement ordonnés) ;
 *  2. insère la promesse ;
 *  3. insère le message dans l'outbox (séquence attribuée après le verrou).
 * Idempotent : une même clé ne crée jamais deux promesses (double clic, réseau instable).
 */
export async function recordDonation(input: RecordDonationInput) {
  const donorName = sanitizeDonorName(input.donorName);
  if (!donorName) throw new DonationError("INVALID", "Nom requis");
  if (!Number.isInteger(input.amount) || input.amount <= 0 || input.amount > MAX_DONATION_AMOUNT) {
    throw new DonationError("INVALID", "Montant invalide");
  }
  const isFictitious = input.source === "MOBILE" ? false : input.isFictitious;
  const key = input.idempotencyKey ?? null;
  const ipHash = input.source === "MOBILE" ? (input.ipHash ?? null) : null;
  const id = "dn_" + randomBytes(12).toString("base64url");
  const windowSeconds = Math.round(PUBLIC_RATE_LIMIT.windowMs / 1000);

  let rows: InsertedRow[];
  try {
    rows = await prisma.$queryRaw<InsertedRow[]>`
      WITH ev AS (
        UPDATE "event" e
        SET "liveTotal" = e."liveTotal" + ${input.amount}::int, "liveCount" = e."liveCount" + 1
        FROM "organization" o
        WHERE e.id = ${input.eventId}
          AND o.id = e."organizationId"
          AND o.status = 'ACTIVE'
          AND (${input.source}::text <> 'MOBILE' OR e.status <> 'ENDED')
          AND (${key}::text IS NULL OR NOT EXISTS (
            SELECT 1 FROM "donation" d WHERE d."eventId" = e.id AND d."idempotencyKey" = ${key}::text))
          AND (${ipHash}::text IS NULL OR (
            SELECT count(*) FROM "donation" d
            WHERE d."eventId" = e.id AND d."ipHash" = ${ipHash}::text
              AND d."createdAt" > (now() AT TIME ZONE 'UTC') - make_interval(secs => ${windowSeconds}::int)
          ) < ${PUBLIC_RATE_LIMIT.max}::int)
        RETURNING e.id, e.currency, e."liveTotal", e."liveCount"
      ), ins AS (
        INSERT INTO "donation" (id, "eventId", "donorName", amount, currency, "isFictitious", source, "idempotencyKey", "ipHash", "createdById", "createdAt", "updatedAt")
        SELECT ${id}, ev.id, ${donorName}, ${input.amount}::int, ev.currency, ${isFictitious}::boolean, ${input.source}::"DonationSource",
               ${key}::text, ${ipHash}::text, ${input.createdById ?? null}::text, now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'
        FROM ev
        RETURNING id, "donorName", amount, "isFictitious", "createdAt"
      ), ob AS (
        INSERT INTO "outbox_event" ("eventId", type, payload, attempts, "createdAt")
        SELECT ev.id, 'donation.created',
          jsonb_build_object(
            'type', 'donation.created',
            'donation', jsonb_build_object(
              'id', ins.id, 'donorName', ins."donorName", 'amount', ins.amount,
              'createdAt', to_char(ins."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
            'total', ev."liveTotal", 'count', ev."liveCount"),
          0, now() AT TIME ZONE 'UTC'
        FROM ev, ins
        RETURNING seq
      )
      SELECT ins.id, ins."donorName", ins.amount, ins."isFictitious", ins."createdAt",
             ev."liveTotal" AS total, ev."liveCount" AS count, ob.seq
      FROM ins, ev, ob`;
  } catch (error) {
    // Course entre deux requêtes portant la même clé d'idempotence (contrainte unique).
    if (key && isUniqueViolation(error)) return existingResult(input.eventId, key);
    throw error;
  }

  const row = rows[0];
  if (row) {
    return {
      donation: { id: row.id, donorName: row.donorName, amount: row.amount, isFictitious: row.isFictitious, createdAt: row.createdAt },
      total: row.total,
      count: row.count,
      duplicate: false,
    };
  }
  // Rien n'a été écrit : on détermine pourquoi (chemin rare, hors flux normal).
  return explainRejection(input.eventId, key, ipHash, input.source);
}

function isUniqueViolation(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return true;
    return error.code === "P2010" && JSON.stringify(error.meta ?? {}).includes("23505");
  }
  return error instanceof Error && /23505|unique constraint/i.test(error.message);
}

async function existingResult(eventId: string, key: string) {
  const existing = await prisma.donation.findUnique({ where: { eventId_idempotencyKey: { eventId, idempotencyKey: key } } });
  if (!existing) throw new DonationError("INVALID", "Promesse introuvable");
  const totals = await computeTotals(prisma, eventId);
  return { donation: existing, ...totals, duplicate: true };
}

async function explainRejection(eventId: string, key: string | null, ipHash: string | null, source: "MANUAL" | "MOBILE") {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { status: true, organization: { select: { status: true } } } });
  if (!event) throw new DonationError("EVENT_NOT_FOUND", "Événement introuvable");
  if (event.organization.status === "SUSPENDED") throw new DonationError("ORG_SUSPENDED", "Association suspendue");
  if (source === "MOBILE" && event.status === "ENDED") throw new DonationError("EVENT_ENDED", "La collecte est terminée");
  if (key) {
    const existing = await prisma.donation.findUnique({ where: { eventId_idempotencyKey: { eventId, idempotencyKey: key } } });
    if (existing) return existingResult(eventId, key);
  }
  if (ipHash) throw new DonationError("RATE_LIMITED", "Trop de promesses en peu de temps");
  throw new DonationError("INVALID", "Promesse refusée");
}

export async function updateDonation(input: {
  donationId: string;
  eventId: string;
  actorId: string;
  organizationId: string;
  donorName?: string;
  amount?: number;
  isFictitious?: boolean;
}) {
  return prisma.$transaction(async (tx) => {
    await lockEvent(tx, input.eventId);
    const before = await tx.donation.findFirst({ where: { id: input.donationId, eventId: input.eventId, deletedAt: null } });
    if (!before) throw new DonationError("NOT_FOUND", "Promesse introuvable");
    const data: Prisma.DonationUpdateInput = {};
    if (input.donorName !== undefined) {
      const name = sanitizeDonorName(input.donorName);
      if (!name) throw new DonationError("INVALID", "Nom requis");
      data.donorName = name;
    }
    if (input.amount !== undefined) {
      if (!Number.isInteger(input.amount) || input.amount <= 0 || input.amount > MAX_DONATION_AMOUNT) {
        throw new DonationError("INVALID", "Montant invalide");
      }
      data.amount = input.amount;
    }
    if (input.isFictitious !== undefined && before.source === "MANUAL") data.isFictitious = input.isFictitious;
    const donation = await tx.donation.update({ where: { id: before.id }, data });
    if (donation.amount !== before.amount) {
      await tx.event.update({ where: { id: input.eventId }, data: { liveTotal: { increment: donation.amount - before.amount } } });
    }
    const totals = await computeTotals(tx, input.eventId);
    await appendOutbox(tx, input.eventId, {
      type: "donation.updated",
      donation: toPublicDonation(donation),
      total: totals.total,
      count: totals.count,
    });
    await audit(tx, {
      organizationId: input.organizationId,
      actorId: input.actorId,
      action: "donation.update",
      entityType: "Donation",
      entityId: donation.id,
      metadata: {
        before: { donorName: before.donorName, amount: before.amount, isFictitious: before.isFictitious },
        after: { donorName: donation.donorName, amount: donation.amount, isFictitious: donation.isFictitious },
      },
    });
    return { donation, ...totals };
  });
}

export async function deleteDonation(input: { donationId: string; eventId: string; actorId: string; organizationId: string }) {
  return prisma.$transaction(async (tx) => {
    await lockEvent(tx, input.eventId);
    const before = await tx.donation.findFirst({ where: { id: input.donationId, eventId: input.eventId, deletedAt: null } });
    if (!before) throw new DonationError("NOT_FOUND", "Promesse introuvable");
    await tx.donation.update({ where: { id: before.id }, data: { deletedAt: new Date() } });
    await tx.event.update({ where: { id: input.eventId }, data: { liveTotal: { decrement: before.amount }, liveCount: { decrement: 1 } } });
    const totals = await computeTotals(tx, input.eventId);
    await appendOutbox(tx, input.eventId, {
      type: "donation.deleted",
      donationId: before.id,
      total: totals.total,
      count: totals.count,
    });
    await audit(tx, {
      organizationId: input.organizationId,
      actorId: input.actorId,
      action: "donation.delete",
      entityType: "Donation",
      entityId: before.id,
      metadata: { donorName: before.donorName, amount: before.amount, isFictitious: before.isFictitious },
    });
    return totals;
  });
}
