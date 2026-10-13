import "server-only";
import * as Ably from "ably";

let rest: Ably.Rest | null = null;

/** Ably est optionnel : sans clé, les écrans basculent automatiquement en synchronisation HTTP. */
export function isAblyConfigured() {
  return Boolean(process.env.ABLY_API_KEY);
}

export function getAbly(): Ably.Rest | null {
  if (!isAblyConfigured()) return null;
  if (!rest) rest = new Ably.Rest({ key: process.env.ABLY_API_KEY! });
  return rest;
}

/** Jeton Ably limité à l'abonnement d'un seul canal d'événement. */
export async function createSubscribeTokenRequest(channel: string, clientId?: string) {
  const client = getAbly();
  if (!client) return null;
  return client.auth.createTokenRequest({
    capability: { [channel]: ["subscribe"] },
    clientId,
    ttl: 6 * 60 * 60 * 1000,
  });
}
