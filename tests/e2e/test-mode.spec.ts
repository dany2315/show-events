import { randomBytes } from "node:crypto";
import { expect, request as playwrightRequest, test } from "@playwright/test";
import { fillPublicDonor, fillRegieDonor, key, login, publicDonor, state } from "./helpers";

test.describe.configure({ mode: "serial" });

/** Mode test : au plus 10 promesses de test par événement, formulaire public et Régie confondus. */
test.describe("mode test limité à 10 promesses", () => {
  test("envois simultanés : exactement 10 promesses acceptées, jamais plus", async ({ baseURL }) => {
    test.setTimeout(120_000);
    const s = state();
    const ctx = await playwrightRequest.newContext({ baseURL });
    // 14 téléphones différents envoient en même temps : aucune course possible.
    const responses = await Promise.all(
      Array.from({ length: 14 }, (_, i) =>
        ctx.post(`/api/d/${s.rehearsal.formToken}`, {
          data: { ...publicDonor(`Répétition ${i}`), amount: 10 + i, idempotencyKey: key() },
          headers: { "x-forwarded-for": `10.9.0.${i}`, cookie: `fl_device=${randomBytes(16).toString("base64url")}` },
          timeout: 60_000,
        }),
      ),
    );
    const statuses = responses.map((r) => r.status());
    expect(statuses.filter((st) => st === 200)).toHaveLength(10);
    expect(statuses.filter((st) => st === 409)).toHaveLength(4);
    for (const res of responses.filter((r) => r.status() === 409)) {
      expect((await res.json()).code).toBe("TEST_LIMIT_REACHED");
    }
    const snap = await (await ctx.get(`/api/live/screen/${s.rehearsal.displayToken}`)).json();
    expect(snap.count).toBe(10);
    await ctx.dispose();
  });

  test("régie : compteur x/10, refus au-delà, limite partagée avec le formulaire public", async ({ page, browser }) => {
    const s = state();
    await login(page, s.adminEmail, s.password);
    await page.goto(`/o/${s.orgSlug}/events/${s.rehearsal.id}/regie`);
    await expect(page.locator("[data-test-count]")).toHaveText("10/10 promesses de test");

    // La Régie est refusée elle aussi, avec un message clair
    await fillRegieDonor(page, "Saisie", "Régie");
    await page.getByLabel("Montant", { exact: true }).fill("100");
    await page.getByRole("button", { name: /Ajouter au show/ }).click();
    await expect(page.getByText(/Limite du mode test atteinte \(10 promesses\)/)).toBeVisible();

    // Une suppression libère une place, reprise par la Régie…
    const regie = await (await page.request.get(`/api/events/${s.rehearsal.id}/donations`)).json();
    const del = await page.request.delete(`/api/events/${s.rehearsal.id}/donations/${regie.donations[0].id}`);
    expect(del.status()).toBe(200);
    await expect(page.locator("[data-test-count]")).toHaveText("9/10 promesses de test", { timeout: 20_000 });
    await page.getByRole("button", { name: /Ajouter au show/ }).click();
    await expect(page.getByText(/Saisie Régie · .*ajouté au show/)).toBeVisible();
    await expect(page.locator("[data-test-count]")).toHaveText("10/10 promesses de test", { timeout: 20_000 });

    // … et le formulaire public est de nouveau bloqué, avec un message explicite
    const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await phone.goto(`/d/${s.rehearsal.formToken}`);
    await fillPublicDonor(phone, "Invité", "Tardif");
    await phone.getByRole("button", { name: "100 €", exact: true }).click();
    await phone.getByRole("button", { name: /Envoyer ma promesse/ }).click();
    await expect(phone.locator("form [role=alert]")).toContainText("la limite de 10 promesses de test est atteinte");
    await phone.close();
  });
});
