import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { key, login, publicDonor, state } from "./helpers";

/**
 * Confidentialité : le téléphone et l'e-mail du donateur ne sont visibles que par les administrateurs
 * (fiche événement, export CSV). Jamais dans les données publiques : outbox / temps réel,
 * état de l'écran, API publique, page /screen, formulaire, ni dans la Régie.
 */
test("coordonnées du donateur : jamais diffusées, visibles uniquement par l'administrateur", async ({ page, request }) => {
  const s = state();
  const digits = `6${String(Date.now()).slice(-8)}`;
  const phone = `+33 ${digits}`;
  const normalized = `+33${digits}`;
  const email = `secret.${randomBytes(4).toString("hex")}@exemple.test`;

  const before = await (await request.get(`/api/live/screen/${s.live.displayToken}`)).json();
  const res = await request.post(`/api/d/${s.live.formToken}`, {
    data: { ...publicDonor("Donatrice Discrète", { phone, email }), amount: 42, idempotencyKey: key() },
    headers: { "x-forwarded-for": "10.7.0.1" },
  });
  expect(res.status()).toBe(200);
  const publicBodies = [await res.text()];

  // Écran géant : état complet, messages temps réel (outbox), page /screen et formulaire public
  publicBodies.push(await (await request.get(`/api/live/screen/${s.live.displayToken}`)).text());
  const events = await request.get(`/api/live/screen/${s.live.displayToken}?after=${before.seq}`);
  const eventsText = await events.text();
  expect(eventsText).toContain("Donatrice Discrète");
  publicBodies.push(eventsText);
  publicBodies.push(await (await request.get(`/screen/${s.live.displayToken}`)).text());
  publicBodies.push(await (await request.get(`/d/${s.live.formToken}`)).text());

  // Espace connecté : synchronisation du direct et Régie (accessible aux Utilisateurs Show)
  await login(page, s.adminEmail, s.password);
  publicBodies.push(await (await page.request.get(`/api/live/event/${s.live.id}`)).text());
  publicBodies.push(await (await page.request.get(`/api/live/event/${s.live.id}?after=0`)).text());
  publicBodies.push(await (await page.request.get(`/api/events/${s.live.id}/donations`)).text());
  publicBodies.push(await (await page.request.get(`/o/${s.orgSlug}/events/${s.live.id}/regie`)).text());

  for (const body of publicBodies) {
    expect(body).not.toContain(normalized);
    expect(body).not.toContain(digits);
    expect(body).not.toContain(email);
  }

  // Administrateur : fiche événement et export CSV
  await page.goto(`/o/${s.orgSlug}/events/${s.live.id}`);
  const row = page.locator("tr", { hasText: "Donatrice Discrète" });
  await expect(row.getByText(normalized)).toBeVisible();
  await expect(row.getByText(email)).toBeVisible();
  const csv = await (await page.request.get(`/api/events/${s.live.id}/export`)).text();
  expect(csv).toContain(normalized);
  expect(csv).toContain(email);
});
