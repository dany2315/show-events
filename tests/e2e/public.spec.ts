import { expect, test } from "@playwright/test";
import { publicDonor } from "./helpers";

test.describe("pages publiques", () => {
  test("page d'accueil en français, puis en hébreu (RTL)", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Faites de chaque promesse");
    // L'aperçu animé du show est présent
    await expect(page.locator(".show-root").first()).toBeVisible();

    await page.getByRole("button", { name: "Langue" }).first().click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "he");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("הפכו כל התחייבות");

    await page.getByRole("button", { name: "שפה" }).first().click();
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  });

  test("connexion refusée avec un mauvais mot de passe", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill("inconnu@e2e.test");
    await page.getByLabel("Mot de passe").fill("mauvais-mot-de-passe");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByText("E-mail ou mot de passe incorrect.")).toBeVisible();
  });

  test("les espaces privés redirigent vers la connexion", async ({ page }) => {
    for (const path of ["/app", "/admin", "/o/espoir-pour-demain", "/account"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    }
  });

  test("liens publics invalides", async ({ page, request }) => {
    await page.goto("/screen/lien-invalide-0123456789abcdef");
    await expect(page.getByText("Ce lien de diffusion n'est plus valide.")).toBeVisible();
    await page.goto("/d/lien-invalide-0123456789abcdef");
    await expect(page.getByText("Ce lien n'est plus valide.")).toBeVisible();
    const res = await request.post("/api/d/lien-invalide-0123456789abcdef", { data: { ...publicDonor("X"), amount: 10, idempotencyKey: "abcdefgh1234" } });
    expect(res.status()).toBe(404);
  });

  test("santé de la plateforme", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    expect(await res.json()).toMatchObject({ ok: true, database: "up" });
  });
});
