/**
 * Prépare une association de test isolée (préfixe « e2e- ») pour les tests de bout en bout.
 * Exécuté via tsx par global-setup ; écrit l'état dans tests/e2e/.state.json.
 */
import { config as loadEnv } from "dotenv";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { hashPassword } from "better-auth/crypto";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient, type Prisma } from "../../src/generated/prisma/client";
import { defaultShowConfig } from "../../src/lib/show/config";
import { deriveAccessToken, hashToken, newAccessId } from "../../src/lib/tokens";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL! }) });
const id = () => randomBytes(16).toString("base64url");

async function createUser(name: string, email: string, password: string) {
  const user = await prisma.user.create({ data: { id: id(), name, email, emailVerified: true } });
  await prisma.account.create({ data: { id: id(), userId: user.id, accountId: user.id, providerId: "credential", password: await hashPassword(password) } });
  return user;
}

async function createEvent(organizationId: string, name: string, status: "DRAFT" | "TEST" | "LIVE" | "ENDED") {
  const event = await prisma.event.create({
    data: {
      organizationId,
      name,
      date: new Date(),
      goalAmount: 10_000,
      currency: "EUR",
      locale: "fr",
      status,
      creditConsumedAt: status === "DRAFT" || status === "TEST" ? null : new Date(),
      layout: { create: { config: defaultShowConfig("gala") as unknown as Prisma.InputJsonValue } },
    },
  });
  const tokens: Record<string, string> = {};
  for (const type of ["DONATION_FORM", "DISPLAY"] as const) {
    const accessId = newAccessId();
    const token = deriveAccessToken(accessId);
    await prisma.eventAccess.create({ data: { id: accessId, eventId: event.id, type, tokenHash: hashToken(token) } });
    tokens[type] = token;
  }
  return { id: event.id, formToken: tokens.DONATION_FORM, displayToken: tokens.DISPLAY };
}

async function main() {
  const stamp = Date.now().toString(36);
  const password = randomBytes(10).toString("base64url");
  const org = await prisma.organization.create({
    data: {
      name: `E2E Association ${stamp}`,
      slug: `e2e-${stamp}`,
      subscription: { create: { plan: "PRO_MONTHLY", currentPeriodEnd: new Date(Date.now() + 30 * 864e5) } },
    },
  });
  const admin = await createUser("Admin E2E", `admin-${stamp}@e2e.test`, password);
  await prisma.membership.create({ data: { userId: admin.id, organizationId: org.id, role: "ORG_ADMIN" } });
  // Créé en premier (le plus ancien) : n'écarte pas « Gala E2E » des listes du tableau de bord.
  const rehearsal = await createEvent(org.id, "Répétition E2E", "TEST");
  const live = await createEvent(org.id, "Gala E2E", "LIVE");
  const ended = await createEvent(org.id, "Gala terminé E2E", "ENDED");
  const concurrency = await Promise.all([1, 2, 3].map((n) => createEvent(org.id, `Charge E2E ${n}`, "LIVE")));
  const wifi = await createEvent(org.id, "Salle Wi-Fi E2E", "LIVE");

  writeFileSync(
    "tests/e2e/.state.json",
    JSON.stringify({ stamp, orgId: org.id, orgSlug: org.slug, adminEmail: admin.email, password, live, ended, concurrency, wifi, rehearsal }, null, 2),
  );
  console.log(`[e2e] association de test ${org.slug} prête`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
