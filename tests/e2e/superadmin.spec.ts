import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.describe.configure({ mode: "serial" });

const superEmail = process.env.SEED_SUPER_ADMIN_EMAIL!;
const superPassword = process.env.SEED_SUPER_ADMIN_PASSWORD!;

test.describe("Super Admin : associations et forfaits", () => {
  test.skip(!superEmail || !superPassword, "SEED_SUPER_ADMIN_* non configurés");

  test("création d'une association avec paiement par événement, puis consommation du crédit", async ({ page, browser }) => {
    const stamp = Date.now().toString(36);
    await login(page, superEmail, superPassword);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Super Admin" })).toBeVisible();

    await page.getByRole("link", { name: "Nouvelle association" }).click();
    await page.getByLabel("Nom de l'association").fill(`E2E UI ${stamp}`);
    await page.getByLabel("Identifiant d'URL").fill(`e2e-ui-${stamp}`);
    await page.getByRole("button", { name: /Événement unique/ }).click();
    await page.getByLabel("Nom de l'administrateur").fill("Admin UI");
    await page.getByLabel("E-mail de l'administrateur").fill(`ui-${stamp}@e2e.test`);
    await page.getByRole("button", { name: "Créer" }).click();

    const dialog = page.getByRole("dialog", { name: "Association créée" });
    await expect(dialog).toBeVisible();
    const password = (await dialog.locator("code").textContent())!.trim();

    // Le nouvel administrateur crée son unique événement…
    const admin = await browser.newPage();
    await login(admin, `ui-${stamp}@e2e.test`, password);
    await expect(admin).toHaveURL(new RegExp(`/o/e2e-ui-${stamp}$`));
    await expect(admin.getByText("Aucun événement pour le moment")).toBeVisible();
    await admin.goto(`/o/e2e-ui-${stamp}/events/new`);
    await expect(admin.getByText(/utilisera 1 crédit/)).toBeVisible();
    await admin.getByLabel("Nom de l'événement").fill("Gala Pass E2E");
    await admin.getByLabel("Objectif financier").fill("50000");
    await admin.getByRole("button", { name: /Féerie/ }).click();
    await admin.getByRole("button", { name: "Créer l'événement" }).click();
    await expect(admin.getByRole("heading", { name: "Gala Pass E2E" })).toBeVisible({ timeout: 30_000 });
    await expect(admin.getByText("Formulaire mobile (QR code)")).toBeVisible();
    await expect(admin.getByAltText("QR code")).toBeVisible();

    // …puis n'a plus de crédit
    await admin.goto(`/o/e2e-ui-${stamp}/events/new`);
    await expect(admin.getByText("Vous n'avez plus de crédit d'événement.")).toBeVisible();
    await admin.close();

    // Le Super Admin ajoute un crédit et peut suspendre l'association
    await page.goto("/admin");
    await page.getByRole("link", { name: new RegExp(`E2E UI ${stamp}`) }).click();
    await expect(page.getByText("Gala Pass E2E")).toBeVisible();
    await page.getByRole("button", { name: "1" }).click();
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Forfait mis à jour")).toBeVisible();
    await page.getByRole("button", { name: "Suspendre" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Confirmer" }).click();
    await expect(page.getByText("Association suspendue")).toBeVisible();
  });
});
