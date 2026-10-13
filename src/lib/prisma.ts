import "server-only";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL manquant : configurez la base PostgreSQL (Neon).");
  }
  // Pool dimensionné pour les pics d'un gala ; délais de transaction tolérants
  // (corrections et pilotage sont rares, les promesses passent par un ordre SQL unique).
  const adapter = new PrismaNeon({ connectionString, max: 20 });
  return new PrismaClient({ adapter, transactionOptions: { maxWait: 15_000, timeout: 20_000 } });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
