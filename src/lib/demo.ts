import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { headers } from "next/headers";
import type { Prisma } from "@/generated/prisma/client";
import { auth } from "./auth";
import { prisma } from "./prisma";
import { hashIp } from "./tokens";
import { ensureEventAccesses, getEventLinks } from "./event-access";
import { anonymousLabel } from "./donations";
import { defaultShowConfig } from "./show/config";
import { revealCategoriesBlock } from "./show/categories-layout";
import { DEMO_EMAIL_DOMAIN, DEMO_SLUG_PREFIX, DEMO_TTL_MS, demoSpacesPerHour, isDemoEmail } from "./demo-mode";
import type { AppLocale } from "./constants";

/**
 * Espaces de démonstration (mode démo) : une association, un administrateur connecté
 * automatiquement, un abonnement actif et un gala prêt à l'emploi, par visiteur.
 *
 * Le gala de démonstration est créé directement EN DIRECT : l'abonnement de démo est un
 * abonnement mensuel (événements illimités), le passage en direct ne consomme donc aucun
 * crédit (voir `checkGoLive` dans billing.ts), et le mode test (limité à 10 promesses)
 * n'est pas utilisé. Toutes les données sont fictives.
 */

type DemoDonor = { first: string; last: string; amount: number; category: number | null; anonymous?: boolean; fictitious?: boolean };

type DemoContent = {
  orgName: string;
  userName: string;
  currency: "EUR" | "ILS";
  country: string;
  eventName: string;
  goal: number;
  subtitle: string;
  message: string;
  spotlightThreshold: number;
  categories: Array<{ name: string; color: string }>;
  videos: Array<{ title: string; url: string }>;
  donors: DemoDonor[];
  /** Donateurs utilisés par la simulation de la Régie. */
  simulation: Array<{ first: string; last: string; category: number | null }>;
  simulationAmounts: number[];
  phonePrefix: string;
};

const CATEGORY_COLORS = ["#e4b65c", "#5b9cf5", "#4fc28c"];

/** Courts métrages libres de droits (Blender, licence Creative Commons BY). */
const VIDEO_SPRING = "https://www.youtube.com/watch?v=WhWc3b3KhnY";
const VIDEO_BUNNY = "https://www.youtube.com/watch?v=aqz-KE-bpKQ";

const CONTENT: Record<AppLocale, DemoContent> = {
  fr: {
    orgName: "Association de démonstration",
    userName: "Invité",
    currency: "EUR",
    country: "FR",
    eventName: "Gala de démonstration",
    goal: 75_000,
    subtitle: "Ensemble, faisons grandir l'espoir",
    message: "Merci pour votre générosité ! Scannez le QR code pour faire votre promesse.",
    spotlightThreshold: 5_000,
    categories: [
      { name: "Grands donateurs", color: CATEGORY_COLORS[0] },
      { name: "Familles", color: CATEGORY_COLORS[1] },
      { name: "Entreprises", color: CATEGORY_COLORS[2] },
    ],
    videos: [
      { title: "Spring · court métrage", url: VIDEO_SPRING },
      { title: "Big Buck Bunny · court métrage", url: VIDEO_BUNNY },
    ],
    donors: [
      { first: "Famille", last: "Cohen", amount: 5_000, category: 0 },
      { first: "Sophie", last: "Martin", amount: 250, category: 1 },
      { first: "David", last: "Lévy", amount: 1_800, category: 1 },
      { first: "Cabinet", last: "Benhamou", amount: 7_500, category: 2 },
      { first: "Claire et Antoine", last: "Dubois", amount: 1_000, category: 1 },
      { first: "", last: "", amount: 500, category: null, anonymous: true },
      { first: "Famille", last: "Azoulay", amount: 3_600, category: 0 },
      { first: "Julien", last: "Moreau", amount: 150, category: null },
      { first: "Sarah", last: "Attal", amount: 360, category: 1 },
      { first: "Boulangerie", last: "Laurent", amount: 1_200, category: 2 },
      { first: "Nathalie", last: "Bernard", amount: 2_000, category: 1 },
      { first: "Thomas", last: "Petit", amount: 100, category: null },
      { first: "Famille", last: "Haddad", amount: 10_000, category: 0, fictitious: true },
      { first: "Émilie", last: "Rousseau", amount: 500, category: 1 },
      { first: "Marc et Léa", last: "Fontaine", amount: 2_500, category: 0 },
    ],
    simulation: [
      { first: "Camille", last: "Girard", category: 1 },
      { first: "Famille", last: "Benichou", category: 0 },
      { first: "Hugo", last: "Lefèvre", category: null },
      { first: "Atelier", last: "Mercier", category: 2 },
      { first: "Inès", last: "Garnier", category: 1 },
      { first: "Famille", last: "Sebban", category: 0 },
      { first: "Lucas", last: "Faure", category: null },
      { first: "Chloé", last: "André", category: 1 },
      { first: "Pharmacie", last: "Roux", category: 2 },
      { first: "Raphaël", last: "Blanc", category: 1 },
      { first: "Famille", last: "Toledano", category: 0 },
      { first: "Manon", last: "Chevalier", category: null },
    ],
    simulationAmounts: [50, 100, 180, 250, 360, 500, 750, 1_000, 1_800, 2_500, 5_000],
    phonePrefix: "+336000",
  },
  he: {
    orgName: "עמותת הדגמה",
    userName: "אורח",
    currency: "ILS",
    country: "IL",
    eventName: "ערב התרמה – הדגמה",
    goal: 250_000,
    subtitle: "יחד, מגדילים את התקווה",
    message: "תודה על נדיבותכם! סרקו את קוד ה-QR כדי להצטרף.",
    spotlightThreshold: 18_000,
    categories: [
      { name: "תורמים גדולים", color: CATEGORY_COLORS[0] },
      { name: "משפחות", color: CATEGORY_COLORS[1] },
      { name: "חברות", color: CATEGORY_COLORS[2] },
    ],
    videos: [
      { title: "Spring · סרט קצר", url: VIDEO_SPRING },
      { title: "Big Buck Bunny · סרט קצר", url: VIDEO_BUNNY },
    ],
    donors: [
      { first: "משפחת", last: "כהן", amount: 18_000, category: 0 },
      { first: "דוד", last: "לוי", amount: 1_800, category: 1 },
      { first: "שרה", last: "אברהם", amount: 3_600, category: 1 },
      { first: "חברת", last: "אלון", amount: 25_000, category: 2 },
      { first: "יוסי", last: "מזרחי", amount: 500, category: null },
      { first: "", last: "", amount: 1_000, category: null, anonymous: true },
      { first: "משפחת", last: "אזולאי", amount: 5_400, category: 0 },
      { first: "נועה", last: "ביטון", amount: 360, category: 1 },
      { first: "אבי", last: "דהן", amount: 1_800, category: 1 },
      { first: "מאפיית", last: "השקד", amount: 2_600, category: 2 },
      { first: "רונית", last: "אוחיון", amount: 720, category: 1 },
      { first: "תמר", last: "שפירא", amount: 180, category: null },
      { first: "משפחת", last: "חדד", amount: 36_000, category: 0, fictitious: true },
      { first: "איתי", last: "גבאי", amount: 900, category: 1 },
      { first: "רחל וליאור", last: "כץ", amount: 7_200, category: 0 },
    ],
    simulation: [
      { first: "מיכל", last: "פרץ", category: 1 },
      { first: "משפחת", last: "אוחנה", category: 0 },
      { first: "עומר", last: "שלום", category: null },
      { first: "סטודיו", last: "אורן", category: 2 },
      { first: "יעל", last: "ברק", category: 1 },
      { first: "משפחת", last: "עמר", category: 0 },
      { first: "אריאל", last: "גולן", category: null },
      { first: "הדר", last: "נחום", category: 1 },
      { first: "בית מרקחת", last: "השרון", category: 2 },
      { first: "נועם", last: "רוזן", category: 1 },
      { first: "משפחת", last: "טולדנו", category: 0 },
      { first: "ליה", last: "אדלר", category: null },
    ],
    simulationAmounts: [100, 180, 360, 500, 720, 1_000, 1_800, 2_600, 3_600, 5_400, 18_000],
    phonePrefix: "+9725000",
  },
};

/** Adresse IP (empreinte) du visiteur courant : sert à la limite de créations par heure. */
export async function currentDemoIpHash() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return hashIp(forwarded || h.get("x-real-ip") || "0.0.0.0");
}

export class DemoLimitError extends Error {
  constructor() {
    super("DEMO_RATE_LIMITED");
  }
}

/** Refuse la création au-delà de DEMO_SPACES_PER_HOUR espaces par heure et par adresse IP. */
async function assertDemoQuota(ipHash: string) {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.organization.count({ where: { isDemo: true, demoIpHash: ipHash, createdAt: { gt: since } } });
  if (recent >= demoSpacesPerHour()) throw new DemoLimitError();
}

function demoSlug() {
  return `${DEMO_SLUG_PREFIX}${randomBytes(6).toString("hex")}`;
}

/**
 * Crée un espace de démo complet et connecte le visiteur (cookie de session posé
 * sur la réponse de la Server Action). Retourne le slug de l'association.
 */
export async function createDemoSpace(locale: AppLocale): Promise<{ slug: string; eventId: string }> {
  const ipHash = await currentDemoIpHash();
  await assertDemoQuota(ipHash);
  const content = CONTENT[locale];

  // 1. Compte de démonstration + session (API interne de Better Auth, aucun mot de passe).
  const { userId } = await auth.api.demoSignIn({ body: { name: content.userName }, headers: await headers() });

  // 2. Association isolée, abonnement actif (événements illimités : aucun crédit consommé).
  const now = Date.now();
  const org = await prisma.organization.create({
    data: {
      name: content.orgName,
      slug: demoSlug(),
      country: content.country,
      defaultCurrency: content.currency,
      defaultLocale: locale,
      isDemo: true,
      demoIpHash: ipHash,
      memberships: { create: { userId, role: "ORG_ADMIN" } },
      subscription: {
        create: {
          plan: "PRO_MONTHLY",
          status: "ACTIVE",
          currentPeriodEnd: new Date(now + 2 * DEMO_TTL_MS),
          notes: "Espace de démonstration",
        },
      },
    },
    select: { id: true, slug: true },
  });

  // 3. Gala de démonstration, déjà en direct, avec ses catégories, promesses et vidéos.
  const config = revealCategoriesBlock(defaultShowConfig("velours"), locale === "he");
  config.texts.subtitle = content.subtitle;
  config.texts.message = content.message;
  config.animation.spotlightThreshold = content.spotlightThreshold;

  const startedAt = new Date(now - 40 * 60 * 1000);
  const event = await prisma.event.create({
    data: {
      organizationId: org.id,
      name: content.eventName,
      date: new Date(now + 60 * 60 * 1000),
      goalAmount: content.goal,
      currency: content.currency,
      locale,
      status: "LIVE",
      startedAt,
      creditConsumedAt: startedAt,
      layout: { create: { config: config as unknown as Prisma.InputJsonValue } },
      categories: { create: content.categories.map((c, position) => ({ name: c.name, color: c.color, position })) },
      videos: { create: content.videos.map((v, position) => ({ title: v.title, url: v.url, position })) },
    },
    select: { id: true, categories: { orderBy: { position: "asc" }, select: { id: true } } },
  });
  const categoryIds = event.categories.map((c) => c.id);

  const donations: Prisma.DonationCreateManyInput[] = content.donors.map((d, i) => {
    const mobile = i % 3 !== 1;
    const at = new Date(startedAt.getTime() + (i + 1) * 140_000);
    return {
      eventId: event.id,
      donorName: d.anonymous ? anonymousLabel(locale) : `${d.first} ${d.last}`,
      firstName: d.anonymous ? null : d.first,
      lastName: d.anonymous ? null : d.last,
      isAnonymous: Boolean(d.anonymous),
      phone: mobile ? `${content.phonePrefix}${String(1000 + i).slice(-4)}` : null,
      email: mobile && !d.anonymous ? `donateur${i + 1}@exemple.test` : null,
      amount: d.amount,
      currency: content.currency,
      isFictitious: Boolean(d.fictitious),
      source: mobile && !d.fictitious ? "MOBILE" : "MANUAL",
      createdById: mobile && !d.fictitious ? null : userId,
      categoryId: d.category === null ? null : (categoryIds[d.category] ?? null),
      createdAt: at,
      updatedAt: at,
    };
  });
  await prisma.donation.createMany({ data: donations });
  await prisma.event.update({
    where: { id: event.id },
    data: { liveTotal: content.donors.reduce((sum, d) => sum + d.amount, 0), liveCount: content.donors.length },
  });
  await ensureEventAccesses(event.id);
  await prisma.auditLog.create({ data: { organizationId: org.id, actorId: userId, action: "demo.create", entityType: "Organization", entityId: org.id } });
  return { slug: org.slug, eventId: event.id };
}

/** Une promesse fictive pour la simulation de la Régie (donateur et montant tirés au sort). */
export function randomDemoDonor(locale: AppLocale, index: number) {
  const content = CONTENT[locale];
  // Index consécutifs pendant une simulation : pas deux fois le même donateur à la suite.
  const donor = content.simulation[index % content.simulation.length];
  const amount = content.simulationAmounts[randomInt(content.simulationAmounts.length)];
  return { ...donor, amount, phone: `${content.phonePrefix}${String(randomInt(1000, 9999))}` };
}

/** Espace de démo (association) de l'utilisateur courant, s'il est encore valide. */
export async function findDemoSpaceOf(userId: string, email: string) {
  if (!isDemoEmail(email)) return null;
  return prisma.organization.findFirst({
    where: { isDemo: true, createdAt: { gt: new Date(Date.now() - DEMO_TTL_MS) }, memberships: { some: { userId } } },
    orderBy: { createdAt: "desc" },
    select: { id: true, slug: true },
  });
}

/** Gala de démonstration d'un espace et ses liens publics (bandeau, guide). */
export async function getDemoEventLinks(organizationId: string) {
  const event = await prisma.event.findFirst({ where: { organizationId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } });
  if (!event) return null;
  const links = await getEventLinks(event.id);
  return { eventId: event.id, eventName: event.name, formUrl: links.formUrl, displayUrl: links.displayUrl };
}

/**
 * Supprime les espaces de démo expirés (plus de 24 h) : associations (et, en cascade, événements,
 * promesses, médias, journaux) puis comptes de démonstration. Ne touche jamais une association
 * ordinaire (`isDemo` faux) ni un compte hors du domaine réservé aux démos.
 */
export async function cleanupExpiredDemoSpaces(options: { limit?: number; now?: number } = {}) {
  const cutoff = new Date((options.now ?? Date.now()) - DEMO_TTL_MS);
  const expired = await prisma.organization.findMany({
    where: { isDemo: true, createdAt: { lt: cutoff } },
    orderBy: { createdAt: "asc" },
    take: options.limit ?? 500,
    select: { id: true },
  });
  const organizations = expired.length ? (await prisma.organization.deleteMany({ where: { id: { in: expired.map((o) => o.id) }, isDemo: true } })).count : 0;
  const users = (
    await prisma.user.deleteMany({
      where: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` }, role: "USER", createdAt: { lt: cutoff } },
    })
  ).count;
  return { organizations, users };
}
