/**
 * Données initiales : compte Super Admin + deux associations de démonstration.
 * Idempotent : peut être relancé sans dupliquer les données.
 *
 *   npm run db:seed
 *
 * Identifiants lus depuis l'environnement (.env / .env.local) :
 *   SEED_SUPER_ADMIN_EMAIL, SEED_SUPER_ADMIN_PASSWORD, SEED_DEMO_PASSWORD
 */
import { config as loadEnv } from "dotenv";
import { randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { defaultShowConfig, type ThemeId } from "../src/lib/show/config";
import { deriveAccessToken, hashToken, newAccessId } from "../src/lib/tokens";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL! }) });

function id() {
  return randomBytes(16).toString("base64url");
}

async function ensureUser(name: string, email: string, password: string, role: "USER" | "SUPER_ADMIN" = "USER") {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== role) await prisma.user.update({ where: { id: existing.id }, data: { role } });
    return existing;
  }
  const user = await prisma.user.create({ data: { id: id(), name, email, emailVerified: true, role } });
  await prisma.account.create({
    data: { id: id(), userId: user.id, accountId: user.id, providerId: "credential", password: await hashPassword(password) },
  });
  return user;
}

async function ensureOrg(input: {
  name: string;
  slug: string;
  country: string;
  currency: "EUR" | "ILS" | "USD";
  locale: "fr" | "he";
  plan: "TRIAL" | "EVENT_PASS" | "PRO_MONTHLY" | "PRO_YEARLY";
  credits: number;
}) {
  const existing = await prisma.organization.findUnique({ where: { slug: input.slug } });
  if (existing) return existing;
  const periodEnd = new Date();
  periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  return prisma.organization.create({
    data: {
      name: input.name,
      slug: input.slug,
      country: input.country,
      defaultCurrency: input.currency,
      defaultLocale: input.locale,
      subscription: {
        create: {
          plan: input.plan,
          eventCredits: input.credits,
          currentPeriodEnd: input.plan.startsWith("PRO") ? periodEnd : null,
        },
      },
    },
  });
}

async function ensureMember(userId: string, organizationId: string, role: "ORG_ADMIN" | "SHOW_OPERATOR") {
  await prisma.membership.upsert({
    where: { userId_organizationId: { userId, organizationId } },
    update: { role },
    create: { userId, organizationId, role },
  });
}

async function ensureEvent(input: {
  organizationId: string;
  name: string;
  date: Date;
  goal: number;
  currency: "EUR" | "ILS" | "USD";
  locale: "fr" | "he";
  status: "DRAFT" | "LIVE" | "ENDED";
  theme: ThemeId;
  subtitle: string;
  message: string;
  donations: Array<[string, number, boolean?]>;
  createdById: string;
}) {
  const existing = await prisma.event.findFirst({ where: { organizationId: input.organizationId, name: input.name } });
  if (existing) return existing;
  const config = defaultShowConfig(input.theme);
  config.texts.subtitle = input.subtitle;
  config.texts.message = input.message;
  const event = await prisma.event.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      date: input.date,
      goalAmount: input.goal,
      currency: input.currency,
      locale: input.locale,
      status: input.status,
      startedAt: input.status === "LIVE" ? new Date() : null,
      layout: { create: { config: config as unknown as Prisma.InputJsonValue } },
    },
  });
  for (const type of ["DONATION_FORM", "DISPLAY"] as const) {
    const accessId = newAccessId();
    await prisma.eventAccess.create({ data: { id: accessId, eventId: event.id, type, tokenHash: hashToken(deriveAccessToken(accessId)) } });
  }
  const start = Date.now() - input.donations.length * 90_000;
  let i = 0;
  for (const [donorName, amount, fictitious] of input.donations) {
    await prisma.donation.create({
      data: {
        eventId: event.id,
        donorName,
        amount,
        currency: input.currency,
        isFictitious: Boolean(fictitious),
        source: i % 3 === 0 ? "MOBILE" : "MANUAL",
        createdById: i % 3 === 0 ? null : input.createdById,
        createdAt: new Date(start + i * 90_000),
      },
    });
    i++;
  }
  const agg = await prisma.donation.aggregate({ where: { eventId: event.id, deletedAt: null }, _sum: { amount: true }, _count: { _all: true } });
  await prisma.event.update({ where: { id: event.id }, data: { liveTotal: agg._sum.amount ?? 0, liveCount: agg._count._all } });
  return event;
}

async function main() {
  const superEmail = (process.env.SEED_SUPER_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const superPassword = process.env.SEED_SUPER_ADMIN_PASSWORD ?? "";
  const demoPassword = process.env.SEED_DEMO_PASSWORD ?? "";
  if (!superEmail || superPassword.length < 8 || demoPassword.length < 8) {
    throw new Error("Définissez SEED_SUPER_ADMIN_EMAIL, SEED_SUPER_ADMIN_PASSWORD et SEED_DEMO_PASSWORD (8 caractères min.).");
  }

  const superAdmin = await ensureUser("Super Admin", superEmail, superPassword, "SUPER_ADMIN");

  // Association de démonstration — France
  const espoir = await ensureOrg({ name: "Espoir pour demain", slug: "espoir-pour-demain", country: "FR", currency: "EUR", locale: "fr", plan: "PRO_YEARLY", credits: 0 });
  const espoirAdmin = await ensureUser("Claire Martin", "admin@espoir.test", demoPassword);
  const espoirOperator = await ensureUser("Yoni Régie", "regie@espoir.test", demoPassword);
  await ensureMember(espoirAdmin.id, espoir.id, "ORG_ADMIN");
  await ensureMember(espoirOperator.id, espoir.id, "SHOW_OPERATOR");
  await ensureEvent({
    organizationId: espoir.id,
    name: "Soirée de solidarité 2026",
    date: new Date(Date.now() + 2 * 60 * 60 * 1000),
    goal: 200_000,
    currency: "EUR",
    locale: "fr",
    status: "LIVE",
    theme: "gala",
    subtitle: "Ensemble pour un avenir meilleur",
    message: "Merci pour votre générosité ! Chaque promesse compte.",
    createdById: espoirAdmin.id,
    donations: [
      ["Famille Cohen", 5_000],
      ["David Lévy", 1_800],
      ["Sarah & Michaël", 2_500],
      ["Famille Lévy", 10_000, true],
      ["Rachel B.", 500],
      ["Anonyme", 1_000],
      ["Famille Azoulay", 3_600],
      ["Jonathan M.", 750],
      ["Esther K.", 1_200],
      ["Cabinet Benhamou", 7_500],
      ["Famille Attal", 2_000],
      ["Démonstration", 500, true],
    ],
  });

  // Association de démonstration — Israël (hébreu, shekels)
  const unis = await ensureOrg({ name: "מאוחדים למען ישראל", slug: "unis-pour-israel", country: "IL", currency: "ILS", locale: "he", plan: "EVENT_PASS", credits: 2 });
  const unisAdmin = await ensureUser("נועה כהן", "admin@unis.test", demoPassword);
  await ensureMember(unisAdmin.id, unis.id, "ORG_ADMIN");
  await ensureEvent({
    organizationId: unis.id,
    name: "ערב התרמה 2026",
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    goal: 900_000,
    currency: "ILS",
    locale: "he",
    status: "DRAFT",
    theme: "moderne",
    subtitle: "יחד, רחוק יותר",
    message: "תודה על נדיבותכם!",
    createdById: unisAdmin.id,
    donations: [
      ["משפחת כהן", 18_000],
      ["דוד לוי", 3_600],
      ["משפחת אזולאי", 5_400],
      ["אנונימי", 1_800],
    ],
  });

  console.log("✔ Seed terminé");
  console.log(`  Super Admin : ${superAdmin.email}`);
  console.log("  Démo FR     : admin@espoir.test (admin), regie@espoir.test (Utilisateur Show)");
  console.log("  Démo IL     : admin@unis.test (admin)");
  console.log("  Mots de passe : voir SEED_* dans votre fichier .env");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
