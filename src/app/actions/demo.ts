"use server";

import { after } from "next/server";
import { notFound, redirect } from "next/navigation";
import { assertEventAccess, AccessError, getCurrentUser } from "@/lib/dal";
import { cleanupExpiredDemoSpaces, createDemoSpace, DemoLimitError, findDemoSpaceOf, randomDemoDonor } from "@/lib/demo";
import { DEMO_LIMITS, isDemoMode } from "@/lib/demo-mode";
import { DonationError, recordDonation } from "@/lib/donations";
import { flushOutbox } from "@/lib/live/server";
import { prisma } from "@/lib/prisma";
import { getLocale } from "@/i18n/server";

/** Crée un espace de démo neuf, connecte le visiteur et l'y conduit. */
async function launchDemoSpace(): Promise<never> {
  let target: string;
  try {
    const { slug } = await createDemoSpace(await getLocale());
    target = `/o/${slug}?bienvenue=1`;
  } catch (error) {
    if (error instanceof DemoLimitError) redirect("/demo?erreur=limite");
    console.error("[demo]", error);
    redirect("/demo?erreur=indisponible");
  }
  // Nettoyage opportuniste des espaces expirés, après la réponse.
  after(() => cleanupExpiredDemoSpaces({ limit: 25 }).catch((error) => console.error("[demo] nettoyage", error)));
  redirect(target);
}

/** « Essayer la démo » : reprend l'espace en cours du visiteur, ou en prépare un nouveau. */
export async function startDemoAction(): Promise<void> {
  if (!isDemoMode()) notFound();
  const user = await getCurrentUser();
  const existing = user ? await findDemoSpaceOf(user.id, user.email) : null;
  if (existing) redirect(`/o/${existing.slug}`);
  await launchDemoSpace();
}

/** « Recommencer la démo » : un espace neuf (l'ancien expire avec les autres, sous 24 h). */
export async function restartDemoAction(): Promise<void> {
  if (!isDemoMode()) notFound();
  await launchDemoSpace();
}

export type SimulateResult = { ok: true; donorName: string; amount: number } | { ok: false; error: "ACCESS" | "CLOSED" | "LIMIT" | "SERVER" };

/**
 * Simulation de la Régie de démo : une promesse fictive, comme envoyée depuis un téléphone.
 * Côté serveur, sans empreinte d'appareil ni d'IP : la limite anti-abus du formulaire public
 * ne s'applique pas ; le nombre de promesses d'un événement de démo reste plafonné.
 */
export async function simulateDemoDonationAction(eventId: string, index: number): Promise<SimulateResult> {
  if (!isDemoMode()) return { ok: false, error: "ACCESS" };
  try {
    const { event } = await assertEventAccess(eventId, "event.regie");
    if (!event.organization.isDemo) return { ok: false, error: "ACCESS" };
    const current = await prisma.event.findUnique({ where: { id: eventId }, select: { liveCount: true } });
    if ((current?.liveCount ?? 0) >= DEMO_LIMITS.donationsPerEvent) return { ok: false, error: "LIMIT" };
    const donor = randomDemoDonor(event.locale, Number.isInteger(index) ? Math.abs(index) : 0);
    const category =
      donor.category === null
        ? null
        : await prisma.donorCategory.findFirst({ where: { eventId }, orderBy: { position: "asc" }, skip: donor.category, select: { id: true } });
    const result = await recordDonation({
      eventId,
      firstName: donor.first,
      lastName: donor.last,
      phone: donor.phone,
      categoryId: category?.id ?? null,
      amount: donor.amount,
      isFictitious: false,
      source: "MOBILE",
    });
    after(() => flushOutbox(eventId).catch(() => undefined));
    return { ok: true, donorName: result.donation.donorName, amount: result.donation.amount };
  } catch (error) {
    if (error instanceof AccessError) return { ok: false, error: "ACCESS" };
    if (error instanceof DonationError) return { ok: false, error: error.code === "TEST_LIMIT_REACHED" ? "LIMIT" : "CLOSED" };
    console.error("[demo] simulation", error);
    return { ok: false, error: "SERVER" };
  }
}
