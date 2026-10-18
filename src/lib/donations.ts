import "server-only";
import { randomBytes } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import { appendOutbox, computeTotals, lockEvent, toPublicDonation } from "./live/server";
import { MAX_DONATION_AMOUNT, MAX_EMAIL_LENGTH, MAX_PERSON_NAME_LENGTH, PUBLIC_RATE_LIMIT, type AppLocale } from "./constants";
import { audit } from "./audit";
import { TEST_DONATION_LIMIT } from "./lifecycle";
import { cleanText, displayDonorName, normalizePhone, sanitizeDonorName } from "./donor";
import { dictionaries } from "@/i18n/dictionaries";

export { sanitizeDonorName };

/** Libellé « Anonyme » dans la langue de l'événement (celle de l'écran). */
export function anonymousLabel(locale: AppLocale) {
  return dictionaries[locale].regie.anonymous;
}

type DonorIdentity = { firstName: string | null; lastName: string | null; anonymous: boolean };

/** Prénom / nom nettoyés ; exigés sauf pour un donateur anonyme. */
function cleanIdentity(input: { firstName?: string | null; lastName?: string | null; anonymous?: boolean }): DonorIdentity {
  const firstName = cleanText(input.firstName ?? "", MAX_PERSON_NAME_LENGTH) || null;
  const lastName = cleanText(input.lastName ?? "", MAX_PERSON_NAME_LENGTH) || null;
  const anonymous = Boolean(input.anonymous);
  if (!anonymous && (!firstName || !lastName)) throw new DonationError("INVALID", "Prénom et nom requis");
  return { firstName, lastName, anonymous };
}

export class DonationError extends Error {
  constructor(
    public code:
      | "EVENT_NOT_FOUND"
      | "EVENT_NOT_OPEN"
      | "EVENT_ENDED"
      | "ORG_SUSPENDED"
      | "RATE_LIMITED"
      | "TEST_LIMIT_REACHED"
      | "INVALID"
      | "NOT_FOUND",
    message: string,
  ) {
    super(message);
  }
}

export type RecordDonationInput = {
  eventId: string;
  firstName?: string | null;
  lastName?: string | null;
  /** Coordonnées : réservées aux administrateurs, jamais diffusées. */
  phone?: string | null;
  email?: string | null;
  /** Affiché « Anonyme » sur l'écran. */
  anonymous?: boolean;
  /** Catégorie de donateurs (ignorée si elle n'appartient pas à l'événement). */
  categoryId?: string | null;
  amount: number;
  isFictitious: boolean;
  source: "MANUAL" | "MOBILE";
  idempotencyKey?: string | null;
  ipHash?: string | null;
  deviceHash?: string | null;
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
 *
 * Mode test : au plus TEST_DONATION_LIMIT promesses. En test, toutes les promesses non supprimées
 * sont des promesses de test (le passage en direct les efface, sans retour possible en test) :
 * la condition porte donc sur le compteur `liveCount` de la ligne verrouillée. Sous concurrence,
 * PostgreSQL réévalue cette condition sur la dernière version de la ligne après le verrou :
 * impossible de dépasser la limite, même avec des envois simultanés.
 */
export async function recordDonation(input: RecordDonationInput) {
  const identity = cleanIdentity(input);
  // Nom affiché : « Prénom Nom », ou « Anonyme » dans la langue de l'événement (résolu en SQL).
  const shownName = identity.anonymous ? null : displayDonorName(identity, "");
  const phone = input.phone ? normalizePhone(input.phone) : null;
  if (input.phone && !phone) throw new DonationError("INVALID", "Téléphone invalide");
  const email = input.email ? input.email.trim().toLowerCase().slice(0, MAX_EMAIL_LENGTH) : null;
  const categoryId = input.categoryId || null;
  if (!Number.isInteger(input.amount) || input.amount <= 0 || input.amount > MAX_DONATION_AMOUNT) {
    throw new DonationError("INVALID", "Montant invalide");
  }
  const isFictitious = input.source === "MOBILE" ? false : input.isFictitious;
  const key = input.idempotencyKey ?? null;
  const ipHash = input.source === "MOBILE" ? (input.ipHash ?? null) : null;
  const deviceHash = input.source === "MOBILE" ? (input.deviceHash ?? null) : null;
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
          AND e.status IN ('TEST', 'LIVE')
          AND (e.status <> 'TEST' OR e."liveCount" < ${TEST_DONATION_LIMIT}::int)
          AND (${key}::text IS NULL OR NOT EXISTS (
            SELECT 1 FROM "donation" d WHERE d."eventId" = e.id AND d."idempotencyKey" = ${key}::text))
          AND (${ipHash}::text IS NULL OR (
            SELECT count(*) FROM "donation" d
            WHERE d."eventId" = e.id AND d."ipHash" = ${ipHash}::text
              AND d."createdAt" > (now() AT TIME ZONE 'UTC') - make_interval(secs => ${windowSeconds}::int)
          ) < ${PUBLIC_RATE_LIMIT.perIp}::int)
          AND (${deviceHash}::text IS NULL OR (
            SELECT count(*) FROM "donation" d
            WHERE d."eventId" = e.id AND d."deviceHash" = ${deviceHash}::text
              AND d."createdAt" > (now() AT TIME ZONE 'UTC') - make_interval(secs => ${windowSeconds}::int)
          ) < ${PUBLIC_RATE_LIMIT.perDevice}::int)
        RETURNING e.id, e.currency, e.status, e.locale, e."liveTotal", e."liveCount"
      ), ins AS (
        INSERT INTO "donation" (id, "eventId", "donorName", "firstName", "lastName", phone, email, "isAnonymous", "categoryId", amount, currency, "isFictitious", "isTest", source, "idempotencyKey", "ipHash", "deviceHash", "createdById", "createdAt", "updatedAt")
        SELECT ${id}, ev.id,
               COALESCE(${shownName}::text, CASE WHEN ev.locale = 'he' THEN ${anonymousLabel("he")}::text ELSE ${anonymousLabel("fr")}::text END),
               ${identity.firstName}::text, ${identity.lastName}::text, ${phone}::text, ${email}::text, ${identity.anonymous}::boolean,
               (SELECT c.id FROM "donor_category" c WHERE c.id = ${categoryId}::text AND c."eventId" = ev.id),
               ${input.amount}::int, ev.currency, ${isFictitious}::boolean, ev.status = 'TEST', ${input.source}::"DonationSource",
               ${key}::text, ${ipHash}::text, ${deviceHash}::text, ${input.createdById ?? null}::text, now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'
        FROM ev
        RETURNING id, "donorName", amount, "isFictitious", "categoryId", "createdAt"
      ), ob AS (
        -- Charge utile publique (écrans, temps réel) : jamais de coordonnées du donateur.
        INSERT INTO "outbox_event" ("eventId", type, payload, attempts, "createdAt")
        SELECT ev.id, 'donation.created',
          jsonb_build_object(
            'type', 'donation.created',
            'donation', jsonb_build_object(
              'id', ins.id, 'donorName', ins."donorName", 'amount', ins.amount, 'categoryId', ins."categoryId",
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
  return explainRejection(input.eventId, key, ipHash ?? deviceHash);
}

function isUniqueViolation(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return true;
    return error.code === "P2010" && JSON.stringify(error.meta ?? {}).includes("23505");
  }
  return error instanceof Error && /23505|unique constraint/i.test(error.message);
}

async function existingResult(eventId: string, key: string) {
  const existing = await prisma.donation.findUnique({
    where: { eventId_idempotencyKey: { eventId, idempotencyKey: key } },
    select: { id: true, donorName: true, amount: true, isFictitious: true, createdAt: true },
  });
  if (!existing) throw new DonationError("INVALID", "Promesse introuvable");
  const totals = await computeTotals(prisma, eventId);
  return { donation: existing, ...totals, duplicate: true };
}

async function explainRejection(eventId: string, key: string | null, clientHash: string | null) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { status: true, liveCount: true, organization: { select: { status: true } } },
  });
  if (!event) throw new DonationError("EVENT_NOT_FOUND", "Événement introuvable");
  if (event.organization.status === "SUSPENDED") throw new DonationError("ORG_SUSPENDED", "Association suspendue");
  if (event.status === "ENDED") throw new DonationError("EVENT_ENDED", "La collecte est terminée");
  if (event.status === "DRAFT") throw new DonationError("EVENT_NOT_OPEN", "La collecte n'est pas encore ouverte");
  if (key) {
    const existing = await prisma.donation.findUnique({ where: { eventId_idempotencyKey: { eventId, idempotencyKey: key } } });
    if (existing) return existingResult(eventId, key);
  }
  if (event.status === "TEST" && event.liveCount >= TEST_DONATION_LIMIT) {
    throw new DonationError("TEST_LIMIT_REACHED", `Mode test limité à ${TEST_DONATION_LIMIT} promesses`);
  }
  if (clientHash) throw new DonationError("RATE_LIMITED", "Trop de promesses en peu de temps");
  throw new DonationError("INVALID", "Promesse refusée");
}

export async function updateDonation(input: {
  donationId: string;
  eventId: string;
  actorId: string;
  organizationId: string;
  /** Identité : envoyée en bloc (prénom, nom, anonymat) ; un nom absent est effacé. */
  firstName?: string;
  lastName?: string;
  anonymous?: boolean;
  amount?: number;
  isFictitious?: boolean;
  /** Catégorie de donateurs : null la retire. */
  categoryId?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    await lockEvent(tx, input.eventId);
    const before = await tx.donation.findFirst({ where: { id: input.donationId, eventId: input.eventId, deletedAt: null } });
    if (!before) throw new DonationError("NOT_FOUND", "Promesse introuvable");
    const data: Prisma.DonationUpdateInput = {};
    if (input.firstName !== undefined || input.lastName !== undefined || input.anonymous !== undefined) {
      const identity = cleanIdentity({ firstName: input.firstName, lastName: input.lastName, anonymous: input.anonymous ?? before.isAnonymous });
      const event = await tx.event.findUniqueOrThrow({ where: { id: input.eventId }, select: { locale: true } });
      data.firstName = identity.firstName;
      data.lastName = identity.lastName;
      data.isAnonymous = identity.anonymous;
      data.donorName = displayDonorName(identity, anonymousLabel(event.locale))!;
    }
    if (input.amount !== undefined) {
      if (!Number.isInteger(input.amount) || input.amount <= 0 || input.amount > MAX_DONATION_AMOUNT) {
        throw new DonationError("INVALID", "Montant invalide");
      }
      data.amount = input.amount;
    }
    if (input.isFictitious !== undefined && before.source === "MANUAL") data.isFictitious = input.isFictitious;
    if (input.categoryId !== undefined) {
      const category = input.categoryId
        ? await tx.donorCategory.findFirst({ where: { id: input.categoryId, eventId: input.eventId }, select: { id: true } })
        : null;
      if (input.categoryId && !category) throw new DonationError("INVALID", "Catégorie inconnue");
      data.category = category ? { connect: { id: category.id } } : { disconnect: true };
    }
    const donation = await tx.donation.update({ where: { id: before.id }, data });
    if (donation.amount !== before.amount) {
      await tx.event.update({ where: { id: input.eventId }, data: { liveTotal: { increment: donation.amount - before.amount } } });
    }
    const totals = await computeTotals(tx, input.eventId);
    await appendOutbox(tx, input.eventId, {
      type: "donation.updated",
      donation: toPublicDonation(donation),
      // Ancienne part de la promesse : les écrans corrigent les totaux par catégorie.
      previous: { amount: before.amount, categoryId: before.categoryId },
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
      removed: { amount: before.amount, categoryId: before.categoryId },
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
