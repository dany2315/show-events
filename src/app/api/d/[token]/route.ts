import { randomBytes } from "node:crypto";
import { after } from "next/server";
import { cookies } from "next/headers";
import { clientIp, errorResponse, json } from "@/lib/api";
import { recordDonation } from "@/lib/donations";
import { resolveAccessToken } from "@/lib/event-access";
import { flushOutbox } from "@/lib/live/server";
import { hashToken, hashIp } from "@/lib/tokens";
import { publicDonationSchema } from "@/lib/validation";

/** Identifiant anonyme du téléphone (aucune donnée personnelle) pour la limite anti-abus par appareil. */
const DEVICE_COOKIE = "fl_device";

async function deviceId() {
  const store = await cookies();
  const existing = store.get(DEVICE_COOKIE)?.value;
  if (existing && /^[A-Za-z0-9_-]{16,64}$/.test(existing)) return existing;
  const id = randomBytes(16).toString("base64url");
  store.set(DEVICE_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return id;
}

/**
 * Formulaire mobile (lien / QR code) : sans compte, sans PIN, sans validation.
 * La promesse est réelle et apparaît immédiatement sur le show.
 * Protections : champ piège, limite par téléphone (5/min) et plafond large par IP
 * (tout le Wi-Fi d'une salle partage souvent une seule IP), idempotence.
 * Coordonnées (téléphone, e-mail) : enregistrées pour l'organisateur, jamais renvoyées ni diffusées.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/d/[token]">) {
  try {
    const { token } = await ctx.params;
    const eventId = await resolveAccessToken(token, "DONATION_FORM");
    if (!eventId) return json({ error: "Lien invalide", code: "UNAVAILABLE" }, { status: 404 });

    const body = publicDonationSchema.parse(await request.json());
    if (body.website) {
      // Robot : on répond comme si tout allait bien, sans rien enregistrer.
      return json({ ok: true, donation: { donorName: `${body.firstName} ${body.lastName}`, amount: body.amount } });
    }

    const result = await recordDonation({
      eventId,
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone,
      email: body.email ?? null,
      anonymous: body.anonymous,
      amount: body.amount,
      isFictitious: false,
      source: "MOBILE",
      idempotencyKey: body.idempotencyKey,
      ipHash: hashIp(clientIp(request)),
      deviceHash: hashToken(`device:${await deviceId()}`).slice(0, 32),
    });
    after(() => flushOutbox(eventId).catch(() => undefined));
    return json({
      ok: true,
      duplicate: result.duplicate,
      donation: { donorName: result.donation.donorName, amount: result.donation.amount },
      total: result.total,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
