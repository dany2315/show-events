import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";

type Db = Prisma.TransactionClient | typeof prisma;

export async function audit(
  db: Db,
  entry: {
    organizationId?: string | null;
    actorId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Prisma.InputJsonValue;
  },
) {
  await db.auditLog.create({
    data: {
      organizationId: entry.organizationId ?? null,
      actorId: entry.actorId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata,
    },
  });
}
