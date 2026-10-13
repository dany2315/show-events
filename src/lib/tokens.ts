import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

function secret() {
  const value = process.env.BETTER_AUTH_SECRET;
  if (!value) throw new Error("BETTER_AUTH_SECRET manquant.");
  return value;
}

/**
 * Jeton d'accès public d'un événement (formulaire mobile ou écran géant).
 * Le jeton est dérivé par HMAC de l'identifiant de l'accès + un sel aléatoire stocké
 * dans l'identifiant : on peut le réafficher aux administrateurs sans le stocker en clair,
 * tandis que la base ne contient que son empreinte (tokenHash).
 */
export function deriveAccessToken(accessId: string) {
  return createHmac("sha256", secret()).update(`event-access:${accessId}`).digest("base64url").slice(0, 26);
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newAccessId() {
  return "acc_" + randomBytes(12).toString("base64url");
}

export function hashIp(ip: string) {
  return createHmac("sha256", secret()).update(`ip:${ip}`).digest("hex").slice(0, 32);
}

export function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Mot de passe temporaire lisible (pas de caractères ambigus). */
export function generateTempPassword(length = 12) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}
