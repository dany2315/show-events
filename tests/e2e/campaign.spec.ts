import { expect, test, type Page } from "@playwright/test";
import { fillPublicDonor, login, state } from "./helpers";

test.describe.configure({ mode: "serial" });
const dir = "tests/e2e/__screens__";
const CAMPAIGN = "https://campagne.exemple.test/don?ref=gala-e2e";

/** La page de campagne est externe : la navigation est interceptée, sans quitter l'environnement de test. */
async function stubCampaign(page: Page) {
  await page.route("https://campagne.exemple.test/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: "<!doctype html><title>Campagne</title><h1>Page de la campagne</h1>" }),
  );
}

async function promise(page: Page, firstName: string) {
  await fillPublicDonor(page, firstName, "Campagne");
  await page.getByRole("button", { name: "100 €", exact: true }).click();
  await page.getByRole("button", { name: /Envoyer ma promesse/ }).click();
  await expect(page.getByRole("heading", { name: `Merci ${firstName} !` })).toBeVisible();
}

test.describe("lien de la campagne et redirection après la promesse", () => {
  test("fiche événement : lien de campagne validé (http/https uniquement)", async ({ page }) => {
    const s = state();
    await login(page, s.adminEmail, s.password);
    await page.goto(`/o/${s.orgSlug}/events/${s.wifi.id}`);
    const field = page.getByLabel(/Lien de la campagne de dons/);
    await expect(page.getByText("Page de votre campagne de dons, où le donateur finalisera son don.", { exact: false })).toBeVisible();
    await field.fill("javascript:alert(1)");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText(/Lien invalide/).first()).toBeVisible();
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await field.fill(CAMPAIGN);
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Événement mis à jour")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel(/Lien de la campagne de dons/)).toHaveValue(CAMPAIGN);
  });

  test("avec lien : bouton « Finaliser mon don », compte à rebours annulable, puis redirection", async ({ browser }) => {
    const s = state();
    const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await stubCampaign(phone);
    const formPath = `/d/${s.wifi.formToken}`;
    await phone.goto(formPath);

    await promise(phone, "Rachel");
    const link = phone.getByRole("link", { name: /Finaliser mon don/ });
    await expect(link).toHaveAttribute("href", CAMPAIGN);
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(await link.getAttribute("target")).toBeNull();
    await expect(phone.getByRole("status")).toHaveText(/Redirection automatique dans [1-5] s/);
    if (process.env.E2E_SCREENSHOTS) await phone.waitForTimeout(900);
    if (process.env.E2E_SCREENSHOTS) await phone.screenshot({ path: `${dir}/26-mobile-confirmation-campagne.png`, fullPage: true });

    // « Rester sur cette page » annule la redirection
    await phone.getByRole("button", { name: "Rester sur cette page" }).click();
    await expect(phone.getByRole("status")).toHaveCount(0);
    await phone.waitForTimeout(6000);
    expect(new URL(phone.url()).pathname).toBe(formPath);
    await expect(link).toBeVisible();

    // Nouvelle promesse : redirection automatique vers la page de la campagne (même onglet)
    await phone.getByRole("button", { name: "Faire une autre promesse" }).click();
    await phone.getByRole("button", { name: "100 €", exact: true }).click();
    await phone.getByRole("button", { name: /Envoyer ma promesse/ }).click();
    await expect(phone.getByRole("heading", { name: "Merci Rachel !" })).toBeVisible();
    await phone.waitForURL(CAMPAIGN, { timeout: 15_000 });
    await expect(phone.getByRole("heading", { name: "Page de la campagne" })).toBeVisible();
    await phone.close();
  });

  test("sans lien : confirmation habituelle, aucune redirection", async ({ browser }) => {
    const s = state();
    const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const formPath = `/d/${s.live.formToken}`;
    await phone.goto(formPath);
    await promise(phone, "Noam");
    await expect(phone.getByRole("link", { name: /Finaliser mon don/ })).toHaveCount(0);
    await expect(phone.getByRole("button", { name: "Faire une autre promesse" })).toBeVisible();
    await phone.waitForTimeout(6000);
    expect(new URL(phone.url()).pathname).toBe(formPath);
    await phone.close();
  });
});
