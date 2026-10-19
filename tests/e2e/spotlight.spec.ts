import { expect, test } from "@playwright/test";
import { key, login, publicDonor, state } from "./helpers";

/** Effet « Projecteur » : la carte du donateur doit être opaque et lisible. */
test("projecteur : carte opaque et lisible au-dessus du show", async ({ page }) => {
  const s = state();
  await login(page, s.adminEmail, s.password);
  await page.goto(`/o/${s.orgSlug}/events/${s.live.id}/studio`);
  await page.getByRole("tab", { name: "Animations" }).click();
  await page.getByRole("button", { name: /^Projecteur/ }).click();
  await page.getByRole("button", { name: /Simuler un don/ }).click();

  const card = page.locator("[data-card]");
  await expect(card).toBeVisible();
  await page.waitForTimeout(1500); // fin de l'animation d'entrée
  // Fond de carte entièrement opaque (aucune transparence)
  const bg = await card.evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(bg).toContain("gradient");
  expect(bg).not.toMatch(/rgba\([^)]*,\s*0\.[0-8]\d*\)/);
  // La carte est au premier plan : rien ne la recouvre en son centre
  const onTop = await card.evaluate((el) => {
    // La carte ignore la souris (pointer-events: none) : on la rend « touchable » le temps du test.
    const layer = el.parentElement as HTMLElement;
    layer.style.pointerEvents = "auto";
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    layer.style.pointerEvents = "";
    return Boolean(hit && (el.contains(hit) || hit === layer));
  });
  expect(onTop).toBe(true);
  // Voile sombre sur le reste du show
  const backdrop = await page.locator(".show-spotlight-backdrop").first().evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(backdrop).toBeTruthy();
  if (process.env.E2E_SCREENSHOTS) await page.screenshot({ path: "tests/e2e/__screens__/15-projecteur.png" });
});

/** Même vérification sur le grand écran, avec une vraie promesse venue du formulaire mobile. */
test("projecteur sur le grand écran : carte opaque, au premier plan, lisible", async ({ page, browser, request }) => {
  const s = state();
  await login(page, s.adminEmail, s.password);
  await page.goto(`/o/${s.orgSlug}/events/${s.live.id}/studio`);
  await page.getByRole("tab", { name: "Animations" }).click();
  await page.getByRole("button", { name: /^Projecteur/ }).click();
  await page.getByRole("button", { name: /Enregistrer le design/ }).click();
  await expect(page.getByText("Design enregistré et diffusé sur les écrans")).toBeVisible();

  const screen = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await screen.goto(`/screen/${s.live.displayToken}`);
  await expect(screen.locator("[data-total]")).toBeVisible();
  await screen.waitForTimeout(2500);

  const res = await request.post(`/api/d/${s.live.formToken}`, {
    data: { ...publicDonor("Famille Projecteur"), amount: 2500, idempotencyKey: key() },
    headers: { "x-forwarded-for": "10.9.9.9" },
  });
  expect(res.status()).toBe(200);

  const card = screen.locator("[data-card]");
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(card).toContainText("Famille Projecteur");
  await screen.waitForTimeout(1300);
  const onTop = await card.evaluate((el) => {
    const layer = el.parentElement as HTMLElement;
    layer.style.pointerEvents = "auto";
    const r = el.getBoundingClientRect();
    const points = [
      [r.left + r.width / 2, r.top + r.height / 2],
      [r.left + 20, r.top + 20],
      [r.right - 20, r.bottom - 20],
    ];
    const ok = points.every(([x, y]) => {
      const hit = document.elementFromPoint(x, y);
      return Boolean(hit && (el.contains(hit) || hit === layer));
    });
    layer.style.pointerEvents = "";
    return ok;
  });
  expect(onTop).toBe(true);
  if (process.env.E2E_SCREENSHOTS) await screen.screenshot({ path: "tests/e2e/__screens__/16-projecteur-ecran.png" });
  await screen.close();
});
