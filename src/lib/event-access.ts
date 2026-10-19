import "server-only";
import { getAppUrl } from "./app-url";
import { prisma } from "./prisma";
import { deriveAccessToken, hashToken, newAccessId } from "./tokens";

type AccessKind = "DONATION_FORM" | "DISPLAY";

async function createAccess(eventId: string, type: AccessKind) {
  const id = newAccessId();
  const token = deriveAccessToken(id);
  await prisma.eventAccess.create({ data: { id, eventId, type, tokenHash: hashToken(token) } });
  return { id, token };
}

/** Garantit l'existence des liens publics d'un événement et retourne leurs jetons. */
export async function ensureEventAccesses(eventId: string) {
  const existing = await prisma.eventAccess.findMany({
    where: { eventId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, type: true },
  });
  const form = existing.find((a) => a.type === "DONATION_FORM");
  const display = existing.find((a) => a.type === "DISPLAY");
  return {
    formToken: form ? deriveAccessToken(form.id) : (await createAccess(eventId, "DONATION_FORM")).token,
    displayToken: display ? deriveAccessToken(display.id) : (await createAccess(eventId, "DISPLAY")).token,
  };
}

export async function getEventLinks(eventId: string) {
  const [{ formToken, displayToken }, appUrl] = await Promise.all([ensureEventAccesses(eventId), getAppUrl()]);
  return {
    formToken,
    displayToken,
    formUrl: `${appUrl}/d/${formToken}`,
    displayUrl: `${appUrl}/screen/${displayToken}`,
  };
}

/** Retrouve l'événement associé à un jeton public valide. */
export async function resolveAccessToken(token: string, type: AccessKind) {
  if (!token || token.length < 20 || token.length > 64) return null;
  const access = await prisma.eventAccess.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { eventId: true, type: true, revokedAt: true },
  });
  if (!access || access.revokedAt || access.type !== type) return null;
  return access.eventId;
}

/** Régénère un lien (l'ancien cesse immédiatement de fonctionner). */
export async function rotateAccess(eventId: string, type: AccessKind) {
  await prisma.eventAccess.updateMany({ where: { eventId, type, revokedAt: null }, data: { revokedAt: new Date() } });
  return createAccess(eventId, type);
}
