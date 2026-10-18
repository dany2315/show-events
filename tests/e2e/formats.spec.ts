import { expect, test, type Page } from "@playwright/test";
import { BACKGROUNDS } from "../../src/lib/show/themes";
import { FORMAT_LIST } from "../../src/lib/show/formats";
import { login, state } from "./helpers";

/**
 * Formats d'écran : mise en page par format dans le Studio, détection du format sur l'écran
 * géant (taille de la fenêtre ou ?format=), mise en page dérivée sans chevauchement.
 */
test.describe.configure({ mode: "serial" });
const dir = "tests/e2e/__screens__";

/** Rectangles (en px de la scène) des blocs affichés sur l'écran. */
async function blockRects(page: Page) {
  return page.locator(".show-root").first().evaluate((root) =>
    Array.from(root.children)
      .filter((el): el is HTMLElement => el instanceof HTMLElement && el.classList.contains("absolute") && el.style.left !== "" && el.style.width !== "")
      .map((el) => ({ x: parseFloat(el.style.left), y: parseFloat(el.style.top), w: parseFloat(el.style.width), h: parseFloat(el.style.height) })),
  );
}

/** Position verticale (en % de la scène) du bloc « Montant total » sur l'écran. */
async function totalTopPercent(page: Page) {
  return page.locator("[data-total]").first().evaluate((el) => {
    let node = el as HTMLElement;
    while (node.parentElement && !node.parentElement.classList.contains("show-root")) node = node.parentElement;
    return (parseFloat(node.style.top) / (node.parentElement as HTMLElement).offsetHeight) * 100;
  });
}

async function saveDesign(page: Page) {
  const save = page.getByRole("button", { name: /Enregistrer le design/ });
  if (await save.isEnabled()) {
    await save.click();
    await expect(page.getByText("Design enregistré et diffusé sur les écrans").first()).toBeVisible();
  }
}

test("studio : mise en page 9:16 personnalisée, enregistrée et diffusée sur un écran portrait", async ({ page, browser }) => {
  const s = state();
  await login(page, s.adminEmail, s.password);
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(`/o/${s.orgSlug}/events/${s.live.id}/studio`);
  await page.getByRole("tab", { name: "Éléments" }).click();

  // Le Studio s'ouvre en 16:9, la mise en page principale.
  const status = page.locator("[data-format-status]");
  await expect(page.getByRole("radio", { name: /^16:9/ })).toHaveAttribute("aria-checked", "true");
  await expect(status).toHaveText("Mise en page principale");
  await expect(page.locator("main .show-root")).toHaveAttribute("data-format", "16:9");

  // Passage en 9:16 : canevas portrait, mise en page adaptée automatiquement.
  await page.getByRole("radio", { name: /^9:16/ }).click();
  const stage = page.locator("main .show-root");
  await expect(stage).toHaveAttribute("data-format", "9:16");
  // Si un essai précédent a laissé une mise en page personnalisée, on repart de l'adaptation automatique.
  if ((await status.getAttribute("data-format-status")) === "custom") {
    await page.getByRole("button", { name: "Réinitialiser depuis 16:9" }).click();
  }
  await expect(status).toHaveText("Adaptée automatiquement");
  const box = (await stage.boundingBox())!;
  expect(box.height).toBeGreaterThan(box.width * 1.5);
  await expect(page.getByText("Aucun chevauchement")).toBeVisible();
  if (process.env.E2E_SCREENSHOTS) {
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${dir}/23-studio-format-9x16.png` });
  }

  // Déplacement du bloc « Montant total » à la souris (de 6 % de la hauteur vers le bas).
  await page.getByRole("button", { name: /^Montant total/ }).click();
  const props = page.locator("aside").last();
  const yBefore = Number(await props.getByLabel("Y (%)").inputValue());
  const total = page.locator("main [data-total]");
  const t = (await total.boundingBox())!;
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2);
  await page.mouse.down();
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2 + box.height * 0.03, { steps: 5 });
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2 + box.height * 0.06, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => Number(await props.getByLabel("Y (%)").inputValue())).toBeGreaterThan(yBefore + 3);
  const yAfter = Number(await props.getByLabel("Y (%)").inputValue());
  await expect(status).toHaveText("Personnalisée");
  await expect(page.getByRole("button", { name: "Réinitialiser depuis 16:9" })).toBeVisible();

  // Le 16:9 n'a pas bougé.
  await page.getByRole("radio", { name: /^16:9/ }).click();
  await expect(page.locator("main .show-root")).toHaveAttribute("data-format", "16:9");
  expect(Number(await props.getByLabel("Y (%)").inputValue())).not.toBeCloseTo(yAfter, 0);
  await page.getByRole("radio", { name: /^9:16/ }).click();
  await expect(props.getByLabel("Y (%)")).toHaveValue(String(yAfter));

  await saveDesign(page);
  await expect(page.getByText("À jour")).toBeVisible();

  // Écran portrait (1080 × 1920) : scène 9:16 avec la mise en page personnalisée.
  const portrait = await browser.newPage({ viewport: { width: 540, height: 960 } });
  await portrait.goto(`/screen/${s.live.displayToken}`);
  await expect(portrait.locator(".show-root")).toHaveAttribute("data-format", "9:16");
  await expect.poll(() => totalTopPercent(portrait)).toBeCloseTo(yAfter, 0);
  if (process.env.E2E_SCREENSHOTS) {
    await portrait.waitForTimeout(3200);
    await portrait.screenshot({ path: `${dir}/21-format-personnalise-9x16.png` });
  }
  await portrait.close();

  // Retour à l'adaptation automatique (les captures suivantes jugent la mise en page dérivée).
  await page.getByRole("button", { name: "Réinitialiser depuis 16:9" }).click();
  await expect(status).toHaveText("Adaptée automatiquement");
  await saveDesign(page);
  await page.close();
});

test("écran : format détecté selon la fenêtre, recalculé sans rechargement, ou imposé par ?format=", async ({ browser }) => {
  const s = state();
  // 21:9 : mise en page dérivée, sans chevauchement, dans la surface.
  const wide = await browser.newPage({ viewport: { width: 1680, height: 720 } });
  await wide.goto(`/screen/${s.live.displayToken}`);
  const root = wide.locator(".show-root");
  await expect(root).toHaveAttribute("data-format", "21:9");
  await expect(wide.locator("[data-total]")).toBeVisible();
  const rects = await blockRects(wide);
  expect(rects.length).toBeGreaterThanOrEqual(5);
  for (const [i, a] of rects.entries()) {
    expect(a.x).toBeGreaterThanOrEqual(0);
    expect(a.x + a.w).toBeLessThanOrEqual(2520 + 1);
    expect(a.y + a.h).toBeLessThanOrEqual(1080 + 1);
    for (const b of rects.slice(i + 1)) {
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      expect(ox > 4 && oy > 4, "blocs qui se chevauchent").toBe(false);
    }
  }
  // La scène remplit la fenêtre (letterbox minimal).
  const box = (await root.boundingBox())!;
  expect(box.width).toBeGreaterThan(1680 * 0.97);

  // Rotation / redimensionnement : la scène change de format sans rechargement.
  const marker = await wide.evaluate(() => ((window as unknown as { __marker: number }).__marker = 42));
  await wide.setViewportSize({ width: 720, height: 1280 });
  await expect(root).toHaveAttribute("data-format", "9:16");
  await wide.setViewportSize({ width: 1600, height: 1000 });
  await expect(root).toHaveAttribute("data-format", "16:10");
  expect(await wide.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(marker);
  await expect(wide.locator("[data-total]")).toBeVisible();
  await wide.close();

  // Format imposé par l'URL, quelle que soit la fenêtre.
  const forced = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await forced.goto(`/screen/${s.live.displayToken}?format=9:16`);
  await expect(forced.locator(".show-root")).toHaveAttribute("data-format", "9:16");
  await forced.goto(`/screen/${s.live.displayToken}?format=portrait`);
  await expect(forced.locator(".show-root")).toHaveAttribute("data-format", "9:16");
  await forced.goto(`/screen/${s.live.displayToken}?format=32x9`);
  await expect(forced.locator(".show-root")).toHaveAttribute("data-format", "32:9");
  // Valeur inconnue : détection automatique (16:10 pour 1440 × 900).
  await forced.goto(`/screen/${s.live.displayToken}?format=5:4`);
  await expect(forced.locator(".show-root")).toHaveAttribute("data-format", "16:10");
  await forced.close();
});

/** Captures de l'écran géant dans chaque format, sur plusieurs arrière-plans (revue visuelle). */
test("captures : chaque format d'écran sur plusieurs arrière-plans", async ({ page, browser }) => {
  test.skip(!process.env.E2E_SCREENSHOTS, "captures uniquement avec E2E_SCREENSHOTS=1");
  test.setTimeout(300_000);
  const s = state();
  await login(page, s.adminEmail, s.password);
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(`/o/${s.orgSlug}/events/${s.live.id}/studio`);
  // Un texte d'accueil, pour juger aussi le bloc « Texte » dans chaque format.
  await page.getByRole("tab", { name: "Textes" }).click();
  const message = page.locator("textarea").first();
  await message.fill("Merci à tous pour votre générosité ce soir !");

  for (const theme of ["velours", "jerusalem", "gala"] as const) {
    await page.getByRole("tab", { name: "Style" }).click();
    await page.getByRole("button", { name: BACKGROUNDS[theme].label.fr, exact: true }).click();
    await saveDesign(page);
    for (const f of FORMAT_LIST) {
      const screen = await browser.newPage({ viewport: { width: Math.round(f.width / 2), height: Math.round(f.height / 2) }, deviceScaleFactor: 1 });
      await screen.goto(`/screen/${s.live.displayToken}`);
      await expect(screen.locator(".show-root")).toHaveAttribute("data-format", f.id);
      await expect(screen.locator(`[data-backdrop="${theme}"]`)).toHaveCount(1, { timeout: 20_000 });
      // Commandes de l'écran masquées après 2,5 s d'inactivité.
      await screen.waitForTimeout(3200);
      await screen.screenshot({ path: `${dir}/22-format-${theme}-${f.id.replace(":", "x")}.png` });
      await screen.close();
    }
  }

  // Retour à l'état initial : sans texte, arrière-plan Gala Premium.
  await page.getByRole("tab", { name: "Textes" }).click();
  await page.locator("textarea").first().fill("");
  await saveDesign(page);
});
