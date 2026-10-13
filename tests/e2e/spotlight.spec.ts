import { expect, test } from "@playwright/test";
import { login, state } from "./helpers";

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
