import { expect, test, type Page } from "@playwright/test";
import { fillPublicDonor, fillRegieDonor, login, money, state } from "./helpers";

test.describe.configure({ mode: "serial" });
const dir = "tests/e2e/__screens__";

/** Total d'une catégorie sur le grand écran. */
function categoryTotal(screen: Page, name: string) {
  return screen.locator(`[data-category="${name}"] [data-category-total]`);
}

test("catégories de donateurs : création, promesses par catégorie, totaux en direct sur l'écran", async ({ page, browser }) => {
  test.setTimeout(240_000);
  const s = state();
  await login(page, s.adminEmail, s.password);

  // Création de l'événement avec deux catégories
  await page.goto(`/o/${s.orgSlug}/events/new`);
  await page.getByLabel("Nom de l'événement").fill("Gala catégories E2E");
  await page.getByLabel("Objectif financier").fill("20000");
  await page.getByRole("button", { name: "Ajouter une catégorie" }).click();
  await page.getByLabel("Nom de la catégorie 1").fill("Parrains");
  await page.getByRole("button", { name: "Ajouter une catégorie" }).click();
  await page.getByLabel("Nom de la catégorie 2").fill("Familles");
  if (process.env.E2E_SCREENSHOTS) await page.screenshot({ path: `${dir}/21-creation-categories.png`, fullPage: true });
  await page.getByRole("button", { name: "Créer l'événement" }).click();
  await expect(page.getByRole("heading", { name: "Gala catégories E2E" })).toBeVisible({ timeout: 30_000 });
  const eventUrl = page.url();
  const formUrl = (await page.locator("code", { hasText: "/d/" }).textContent())!.trim();
  const screenUrl = (await page.locator("code", { hasText: "/screen/" }).textContent())!.trim();
  await page.getByRole("button", { name: "Lancer un test" }).click();
  await expect(page.getByText(/Mode test\s?: répétez toute la soirée/)).toBeVisible();

  // Le grand écran affiche le bloc « Catégories » (visible dès qu'il y a des catégories)
  const screen = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await screen.goto(new URL(screenUrl).pathname);
  await expect(screen.locator("[data-categories]")).toBeVisible();
  await expect(categoryTotal(screen, "Parrains")).toHaveText(money(0));
  await expect(categoryTotal(screen, "Familles")).toHaveText(money(0));

  // Formulaire mobile : le donateur choisit sa catégorie
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await phone.goto(new URL(formUrl).pathname);
  await fillPublicDonor(phone, "Sarah", "Parrain");
  await phone.getByRole("radio", { name: "Parrains" }).click();
  await expect(phone.getByRole("radio", { name: "Parrains" })).toHaveAttribute("aria-checked", "true");
  await phone.getByRole("button", { name: "250 €", exact: true }).click();
  if (process.env.E2E_SCREENSHOTS) await phone.screenshot({ path: `${dir}/22-mobile-categorie.png`, fullPage: true });
  await phone.getByRole("button", { name: /Envoyer ma promesse/ }).click();
  await expect(phone.getByRole("heading", { name: "Merci Sarah !" })).toBeVisible();
  await phone.close();
  await expect(categoryTotal(screen, "Parrains")).toHaveText(money(250), { timeout: 20_000 });
  await expect(categoryTotal(screen, "Familles")).toHaveText(money(0));

  // Régie : saisie dans la catégorie « Familles », totaux par catégorie affichés
  const regieUrl = `${new URL(eventUrl).pathname}/regie`;
  await page.goto(regieUrl);
  await fillRegieDonor(page, "Famille", "Benichou");
  await page.getByRole("radio", { name: "Familles" }).click();
  await page.getByLabel("Montant", { exact: true }).fill("100");
  await page.getByRole("button", { name: /Ajouter au show/ }).click();
  await expect(page.getByText(/Famille Benichou · .*ajouté au show/)).toBeVisible();
  await expect(categoryTotal(screen, "Familles")).toHaveText(money(100), { timeout: 20_000 });
  await expect(page.locator('[data-regie-categories] [data-category-total="Familles"]')).toHaveText(money(100), { timeout: 20_000 });
  await expect(page.locator('[data-regie-categories] [data-category-total="Parrains"]')).toHaveText(money(250));
  if (process.env.E2E_SCREENSHOTS) {
    await page.screenshot({ path: `${dir}/23-regie-categories.png` });
    await screen.waitForTimeout(1500);
    await screen.screenshot({ path: `${dir}/24-ecran-categories.png` });
  }

  // Correction : la promesse passe de « Familles » à « Parrains »
  await page.locator("li", { hasText: "Famille Benichou" }).getByRole("button", { name: "Modifier" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "Parrains" }).click();
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Promesse corrigée")).toBeVisible();
  await expect(categoryTotal(screen, "Parrains")).toHaveText(money(350), { timeout: 20_000 });
  await expect(categoryTotal(screen, "Familles")).toHaveText(money(0));

  // Suppression : le total de la catégorie diminue
  await page.locator("li", { hasText: "Sarah Parrain" }).getByRole("button", { name: "Supprimer" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Supprimer" }).click();
  await expect(page.getByText("Promesse supprimée")).toBeVisible();
  await expect(categoryTotal(screen, "Parrains")).toHaveText(money(100), { timeout: 20_000 });

  // Fiche événement : colonne « Catégorie », puis retrait d'une catégorie
  await page.goto(eventUrl);
  await expect(page.locator("tr", { hasText: "Famille Benichou" }).getByText("Parrains")).toBeVisible();
  if (process.env.E2E_SCREENSHOTS) await page.screenshot({ path: `${dir}/25-fiche-categories.png`, fullPage: true });
  await page.getByRole("button", { name: "Retirer la catégorie 2" }).click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Événement mis à jour")).toBeVisible();
  await expect(screen.locator("[data-category]")).toHaveCount(1, { timeout: 20_000 });
  await expect(categoryTotal(screen, "Parrains")).toHaveText(money(100));
  await screen.close();
});
