import { expect, test, type Page } from "@playwright/test";
import { key, login, publicDonor } from "./helpers";

test.describe.configure({ mode: "serial" });

const superEmail = process.env.SEED_SUPER_ADMIN_EMAIL!;
const superPassword = process.env.SEED_SUPER_ADMIN_PASSWORD!;

async function createEvent(page: Page, slug: string, name: string) {
  await page.goto(`/o/${slug}/events/new`);
  await page.getByLabel("Nom de l'événement").fill(name);
  await page.getByLabel("Objectif financier").fill("50000");
  await page.getByRole("button", { name: /Féerie/ }).click();
  await page.getByRole("button", { name: "Créer l'événement" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible({ timeout: 30_000 });
}

test.describe("Super Admin, forfaits et cycle de vie d'un événement", () => {
  test.skip(!superEmail || !superPassword, "SEED_SUPER_ADMIN_* non configurés");

  test("paiement par événement : test gratuit, crédit au passage en direct, fin définitive", async ({ page, browser, request }) => {
    test.setTimeout(240_000);
    const stamp = Date.now().toString(36);
    const slug = `e2e-ui-${stamp}`;

    // Le Super Admin crée l'association avec 1 crédit (« Événement unique »)
    await login(page, superEmail, superPassword);
    await expect(page).toHaveURL(/\/admin$/);
    await page.getByRole("link", { name: "Nouvelle association" }).click();
    await page.getByLabel("Nom de l'association").fill(`E2E UI ${stamp}`);
    await page.getByLabel("Identifiant d'URL").fill(slug);
    await page.getByRole("button", { name: /Événement unique/ }).click();
    await page.getByLabel("Nom de l'administrateur").fill("Admin UI");
    await page.getByLabel("E-mail de l'administrateur").fill(`ui-${stamp}@e2e.test`);
    await page.getByRole("button", { name: "Créer" }).click();
    const dialog = page.getByRole("dialog", { name: "Association créée" });
    await expect(dialog).toBeVisible();
    const password = (await dialog.locator("code").textContent())!.trim();

    // L'administrateur crée son événement : gratuit
    const admin = await browser.newPage();
    await login(admin, `ui-${stamp}@e2e.test`, password);
    await expect(admin).toHaveURL(new RegExp(`/o/${slug}$`));
    await admin.goto(`/o/${slug}/events/new`);
    await expect(admin.getByText(/qu'au passage en direct/)).toBeVisible();
    await createEvent(admin, slug, "Gala Pass E2E");
    const formUrl = (await admin.locator("code", { hasText: "/d/" }).textContent())!.trim();
    const formToken = formUrl.split("/d/")[1];

    // En préparation, aucune promesse n'est acceptée
    const closed = await request.post(`/api/d/${formToken}`, { data: { ...publicDonor("Trop tôt"), amount: 10, idempotencyKey: key() } });
    expect(closed.status()).toBe(409);
    expect((await closed.json()).code).toBe("EVENT_NOT_OPEN");

    // Mode test : gratuit, les promesses sont acceptées
    await admin.getByRole("button", { name: "Lancer un test" }).click();
    await expect(admin.getByText(/Mode test\s?: répétez toute la soirée/)).toBeVisible();
    const testDonation = await request.post(`/api/d/${formToken}`, { data: { ...publicDonor("Testeur"), amount: 777, idempotencyKey: key() } });
    expect(testDonation.status()).toBe(200);
    await admin.reload();
    await expect(admin.getByText("Testeur")).toBeVisible();

    // Passage en direct : 1 crédit utilisé, promesses de test effacées
    await admin.getByRole("button", { name: "Passer en direct" }).click();
    const goLive = admin.getByRole("alertdialog");
    await expect(goLive.getByText(/utilisera 1 crédit/)).toBeVisible();
    await expect(goLive.getByText(/1 promesse\(s\) de test seront effacées/)).toBeVisible();
    await goLive.getByRole("button", { name: "Passer en direct" }).click();
    await expect(admin.getByText(/En direct\s?: les promesses s'affichent/)).toBeVisible();
    await expect(admin.getByText("Testeur")).toHaveCount(0);
    await expect(admin.getByText("Aucune promesse pour le moment.")).toBeVisible();
    expect((await request.post(`/api/d/${formToken}`, { data: { ...publicDonor("Vrai don"), amount: 100, idempotencyKey: key() } })).status()).toBe(200);

    // Fin définitive : plus aucun bouton pour relancer
    await admin.getByRole("button", { name: "Terminer la collecte" }).click();
    await expect(admin.getByText(/Cette action est définitive/)).toBeVisible();
    await admin.getByRole("alertdialog").getByRole("button", { name: "Terminer la collecte" }).click();
    await expect(admin.getByText(/le direct est clos définitivement/)).toBeVisible();
    await expect(admin.getByRole("button", { name: /Rouvrir|Passer en direct|Lancer un test/ })).toHaveCount(0);
    expect((await request.post(`/api/d/${formToken}`, { data: { ...publicDonor("Après la fin"), amount: 10, idempotencyKey: key() } })).status()).toBe(409);

    // Second événement : création possible, mais plus de crédit pour le direct
    await createEvent(admin, slug, "Second gala E2E");
    await admin.getByRole("button", { name: "Lancer un test" }).click();
    await expect(admin.getByText(/Mode test\s?: répétez toute la soirée/)).toBeVisible();
    await admin.getByRole("button", { name: "Passer en direct" }).click();
    await expect(admin.getByRole("alertdialog").getByText("Impossible de passer en direct")).toBeVisible();
    await expect(admin.getByRole("alertdialog").getByText(/plus de crédit/)).toBeVisible();
    await admin.getByRole("button", { name: "Annuler" }).click();
    await admin.close();

    // Le Super Admin ajoute un crédit puis suspend l'association
    await page.goto("/admin");
    await page.getByRole("link", { name: new RegExp(`E2E UI ${stamp}`) }).click();
    await expect(page.getByText("Gala Pass E2E")).toBeVisible();
    await page.getByRole("button", { name: "1", exact: true }).click();
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Forfait mis à jour")).toBeVisible();
    await page.getByRole("button", { name: "Suspendre" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Confirmer" }).click();
    await expect(page.getByText("Association suspendue")).toBeVisible();
  });
});
