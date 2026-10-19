import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "../prisma";
import { normalizeShowConfig } from "../show/config";
import { getAbly } from "./ably";
import { toPublicDonation } from "./public";
import { parseLiveVideo } from "./video";
import type { CategoryDef, PublicCategory } from "../categories";
import {
  channelName,
  EMPTY_CONTROL,
  type LiveControl,
  type LiveEventsResponse,
  type LiveMessage,
  type LiveMessageInput,
  type LiveSnapshot,
} from "./types";

type Tx = Prisma.TransactionClient;

export const SNAPSHOT_DONATIONS = 30;
const MAX_EVENTS_PER_POLL = 200;

/** Verrou par événement : sérialise les écritures du direct (totaux et séquence cohérents). */
export async function lockEvent(tx: Tx, eventId: string) {
  await tx.$queryRaw`SELECT id FROM "event" WHERE id = ${eventId} FOR UPDATE`;
}

/** Total public (réel + fictif) : compteurs du direct maintenus atomiquement sur l'événement. */
export async function computeTotals(db: Tx | typeof prisma, eventId: string) {
  const event = await db.event.findUnique({ where: { id: eventId }, select: { liveTotal: true, liveCount: true } });
  return { total: event?.liveTotal ?? 0, count: event?.liveCount ?? 0 };
}

/** Recalcule les compteurs depuis les promesses (maintenance / import de données). */
export async function recomputeTotals(eventId: string) {
  const agg = await prisma.donation.aggregate({ where: { eventId, deletedAt: null }, _sum: { amount: true }, _count: { _all: true } });
  await prisma.event.update({ where: { id: eventId }, data: { liveTotal: agg._sum.amount ?? 0, liveCount: agg._count._all } });
}

/** Sous-totaux internes (visibles uniquement dans l'administration). */
export async function computeBreakdown(eventId: string) {
  const rows = await prisma.donation.groupBy({
    by: ["isFictitious"],
    where: { eventId, deletedAt: null },
    _sum: { amount: true },
    _count: { _all: true },
  });
  const real = rows.find((r) => !r.isFictitious);
  const fict = rows.find((r) => r.isFictitious);
  return {
    realTotal: real?._sum.amount ?? 0,
    realCount: real?._count._all ?? 0,
    fictitiousTotal: fict?._sum.amount ?? 0,
    fictitiousCount: fict?._count._all ?? 0,
  };
}

/**
 * Totaux par catégorie de donateurs, selon les mêmes règles que le total du show (`liveTotal`) :
 * toutes les promesses non supprimées, réelles, fictives et (en mode test) de test.
 */
export async function computeCategoryTotals(eventId: string, defs: CategoryDef[], db: Tx | typeof prisma = prisma): Promise<PublicCategory[]> {
  if (defs.length === 0) return [];
  const rows = await db.donation.groupBy({
    by: ["categoryId"],
    where: { eventId, deletedAt: null, categoryId: { in: defs.map((c) => c.id) } },
    _sum: { amount: true },
    _count: { _all: true },
  });
  return defs.map((c) => {
    const row = rows.find((r) => r.categoryId === c.id);
    return { id: c.id, name: c.name, color: c.color, total: row?._sum.amount ?? 0, count: row?._count._all ?? 0 };
  });
}

export async function appendOutbox(tx: Tx, eventId: string, message: LiveMessageInput) {
  const row = await tx.outboxEvent.create({
    data: { eventId, type: message.type, payload: message as unknown as Prisma.InputJsonValue },
    select: { seq: true },
  });
  return row.seq;
}

/**
 * Publie sur Ably les messages pas encore diffusés, dans l'ordre.
 * Si Ably est indisponible, les messages restent dans l'outbox : les écrans
 * les récupèrent par synchronisation HTTP, et ils seront retransmis plus tard.
 */
export async function flushOutbox(eventId: string) {
  const ably = getAbly();
  if (!ably) return { published: 0 };
  const pending = await prisma.outboxEvent.findMany({
    where: { eventId, publishedAt: null, attempts: { lt: 10 } },
    orderBy: { seq: "asc" },
    take: 50,
  });
  if (pending.length === 0) return { published: 0 };
  const channel = ably.channels.get(channelName(eventId));
  let published = 0;
  for (const row of pending) {
    const message = { ...(row.payload as object), seq: row.seq } as LiveMessage;
    try {
      await channel.publish(message.type, message);
      await prisma.outboxEvent.update({ where: { seq: row.seq }, data: { publishedAt: new Date(), attempts: { increment: 1 } } });
      published++;
    } catch (error) {
      await prisma.outboxEvent.update({ where: { seq: row.seq }, data: { attempts: { increment: 1 } } });
      console.error("[live] publication Ably échouée", error);
      break; // on conserve l'ordre : les suivants attendront la prochaine tentative
    }
  }
  return { published };
}

export { toPublicDonation };

export function parseControl(value: unknown): LiveControl {
  if (!value || typeof value !== "object") return { ...EMPTY_CONTROL };
  const v = value as Partial<LiveControl>;
  return {
    paused: Boolean(v.paused),
    overlay: typeof v.overlay === "string" && v.overlay.trim() ? v.overlay : null,
    overlayAt: typeof v.overlayAt === "string" ? v.overlayAt : null,
    video: parseLiveVideo(v.video),
  };
}

export async function lastSeq(eventId: string, db: Tx | typeof prisma = prisma) {
  const row = await db.outboxEvent.findFirst({ where: { eventId }, orderBy: { seq: "desc" }, select: { seq: true } });
  return row?.seq ?? 0;
}

/** État complet d'un événement pour l'écran géant (reconnexion, premier chargement). */
export async function buildSnapshot(eventId: string, formUrl: string | null): Promise<LiveSnapshot | null> {
  // Lecture cohérente (une seule image de la base) : les totaux par catégorie sont ensuite mis à jour
  // par incréments côté client, ils doivent correspondre exactement au numéro de séquence renvoyé.
  const read = await prisma.$transaction(async (tx) => {
    const seq = await lastSeq(eventId, tx);
    const event = await tx.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        name: true,
        date: true,
        currency: true,
        locale: true,
        goalAmount: true,
        status: true,
        logoUrl: true,
        liveControl: true,
        organization: { select: { name: true, logoUrl: true } },
        layout: { select: { config: true, version: true } },
        donations: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: SNAPSHOT_DONATIONS,
          select: { id: true, donorName: true, amount: true, createdAt: true, categoryId: true },
        },
        categories: { orderBy: { position: "asc" }, select: { id: true, name: true, color: true } },
      },
    });
    if (!event) return null;
    const totals = await computeTotals(tx, eventId);
    const categories = await computeCategoryTotals(eventId, event.categories, tx);
    return { seq, event, totals, categories };
  }, { isolationLevel: "RepeatableRead" });
  if (!read) return null;
  const { seq, event, totals, categories } = read;
  return {
    seq,
    event: {
      id: event.id,
      name: event.name,
      date: event.date.toISOString(),
      currency: event.currency,
      locale: event.locale,
      goalAmount: event.goalAmount,
      status: event.status,
      logoUrl: event.logoUrl ?? event.organization.logoUrl,
      organizationName: event.organization.name,
      categories,
    },
    total: totals.total,
    count: totals.count,
    donations: event.donations.map(toPublicDonation),
    control: parseControl(event.liveControl),
    layout: normalizeShowConfig(event.layout?.config),
    layoutVersion: event.layout?.version ?? 0,
    formUrl,
  };
}

/** Messages postérieurs à `after` ; demande une resynchronisation complète si l'écart est trop grand. */
export async function eventsSince(
  eventId: string,
  after: number,
  getFormUrl: () => Promise<string | null>,
): Promise<LiveEventsResponse | null> {
  const rows = await prisma.outboxEvent.findMany({
    where: { eventId, seq: { gt: after } },
    orderBy: { seq: "asc" },
    take: MAX_EVENTS_PER_POLL + 1,
    select: { seq: true, payload: true },
  });
  if (rows.length > MAX_EVENTS_PER_POLL) {
    const snapshot = await buildSnapshot(eventId, await getFormUrl());
    return snapshot ? { mode: "resync", snapshot } : null;
  }
  const messages = rows.map((r) => ({ ...(r.payload as object), seq: r.seq }) as LiveMessage);
  return { mode: "events", seq: rows.at(-1)?.seq ?? after, messages };
}
