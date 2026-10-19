import { expect, test, type Page } from "@playwright/test";
import { BACKGROUNDS } from "../../src/lib/show/themes";
import { FORMAT_LIST } from "../../src/lib/show/formats";
import { login, state } from "./helpers";

/**
 * Formats d'écran : mise en page par format dans le Studio, détection du format sur l'écran
 * géant (taille de la fenêtre ou ?format=), mise en page dérivée sans chevauchement,
 * bloc « Catégories » dans les formats larges.
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

/** Aucun chevauchement, tous les blocs dans la surface du format. */
async function expectCleanLayout(page: Page, width: number, height: number, minBlocks = 5) {
  const rects = await blockRects(page);
  expect(rects.length).toBeGreaterThanOrEqual(minBlocks);
  for (const [i, a] of rects.entries()) {
    expect(a.x).toBeGreaterThanOrEqual(0);
    expect(a.y).toBeGreaterThanOrEqual(0);
    expect(a.x + a.w).toBeLessThanOrEqual(width + 1);
    expect(a.y + a.h).toBeLessThanOrEqual(height + 1);
    for (const b of rects.slice(i + 1)) {
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      expect(ox > 4 && oy > 4, "blocs qui se chevauchent").toBe(false);
    }
  }
}

async function saveDesign(page: Page) {
  const save = page.getByRole("button", { name: /Enregistrer le design/ });
  if (await save.isEnabled()) {
    await save.click();
    await expect(page.getByText("Design enregistré et diffusé sur les écrans").first()).toBeVisible();
  }
}

test("studio : mise en page 4:3 personnalisée, enregistrée et diffusée sur un projecteur 4:3", async ({ page, browser }) => {
  const s = state();
  await login(page, s.adminEmail, s.password);
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(`/o/${s.orgSlug}/events/${s.live.id}/studio`);
  await page.getByRole("tab", { name: "Éléments" }).click();

  // Le Studio s'ouvre en 16:9, la mise en page principale ; aucun format portrait n'est proposé.
  const status = page.locator("[data-format-status]");
  await expect(page.getByRole("radio", { name: /^16:9/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("radio")).toHaveCount(5);
  await expect(page.getByRole("radio", { name: /^9:16/ })).toHaveCount(0);
  await expect(status).toHaveText("Mise en page principale");
  await expect(page.locator("main .show-root")).toHaveAttribute("data-format", "16:9");

  // Aperçu 21:9 : canevas très large, mise en page adaptée automatiquement.
  await page.getByRole("radio", { name: /^21:9/ }).click();
  await expect(page.locator("main .show-root")).toHaveAttribute("data-format", "21:9");
  await expect(status).toHaveText("Adaptée automatiquement");
  const wideBox = (await page.locator("main .show-root").boundingBox())!;
  expect(wideBox.width / wideBox.height).toBeCloseTo(2520 / 1080, 1);
  await expect(page.getByText("Aucun chevauchement")).toBeVisible();
  if (process.env.E2E_SCREENSHOTS) {
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${dir}/29-studio-format-21x9.png` });
  }

  // Passage en 4:3 : mise en page reprise du 16:9.
  await page.getByRole("radio", { name: /^4:3/ }).click();
  const stage = page.locator("main .show-root");
  await expect(stage).toHaveAttribute("data-format", "4:3");
  // Si un essai précédent a laissé une mise en page personnalisée, on repart de l'adaptation automatique.
  if ((await status.getAttribute("data-format-status")) === "custom") {
    await page.getByRole("button", { name: "Réinitialiser depuis 16:9" }).click();
  }
  await expect(status).toHaveText("Adaptée automatiquement");
  const box = (await stage.boundingBox())!;
  expect(box.width / box.height).toBeCloseTo(4 / 3, 1);

  // Déplacement du logo à la souris (≈ 4 % de la hauteur vers le bas, dans la place libre au-dessus du titre).
  await page.getByRole("button", { name: /^Logo/ }).click();
  const props = page.locator("aside").last();
  const yBefore = Number(await props.getByLabel("Y (%)").inputValue());
  const logo = (await page.locator("main .show-root .react-draggable.z-20").boundingBox())!;
  await page.mouse.move(logo.x + logo.width / 2, logo.y + logo.height / 2);
  await page.mouse.down();
  await page.mouse.move(logo.x + logo.width / 2, logo.y + logo.height / 2 + box.height * 0.02, { steps: 5 });
  await page.mouse.move(logo.x + logo.width / 2, logo.y + logo.height / 2 + box.height * 0.04, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => Number(await props.getByLabel("Y (%)").inputValue())).toBeGreaterThan(yBefore + 2);
  const yAfter = Number(await props.getByLabel("Y (%)").inputValue());
  await expect(status).toHaveText("Personnalisée");
  await expect(page.getByRole("button", { name: "Réinitialiser depuis 16:9" })).toBeVisible();

  // Le 16:9 n'a pas bougé.
  await page.getByRole("radio", { name: /^16:9/ }).click();
  await expect(page.locator("main .show-root")).toHaveAttribute("data-format", "16:9");
  await expect(props.getByLabel("Y (%)")).toHaveValue(String(yBefore));
  await page.getByRole("radio", { name: /^4:3/ }).click();
  await expect(props.getByLabel("Y (%)")).toHaveValue(String(yAfter));

  await saveDesign(page);
  await expect(page.getByText("À jour")).toBeVisible();

  // Projecteur 4:3 : scène 4:3 avec la mise en page personnalisée (logo déplacé).
  const projector = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  await projector.goto(`/screen/${s.live.displayToken}`);
  await expect(projector.locator(".show-root")).toHaveAttribute("data-format", "4:3");
  await expect
    .poll(() =>
      projector.locator(".show-root").first().evaluate((root) => {
        // Bloc du logo : le médaillon des initiales de l'association.
        const block = Array.from(root.children).find((el) => el instanceof HTMLElement && el.querySelector(".rounded-full.show-display"));
        return block ? (parseFloat((block as HTMLElement).style.top) / (root as HTMLElement).offsetHeight) * 100 : -1;
      }),
    )
    .toBeCloseTo(yAfter, 0);
  if (process.env.E2E_SCREENSHOTS) {
    await projector.waitForTimeout(3200);
    await projector.screenshot({ path: `${dir}/27-format-personnalise-4x3.png` });
  }
  await projector.close();

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
  await expectCleanLayout(wide, 2520, 1080);
  // La scène remplit la fenêtre (letterbox minimal).
  const box = (await root.boundingBox())!;
  expect(box.width).toBeGreaterThan(1680 * 0.97);

  // Redimensionnement : la scène change de format sans rechargement.
  const marker = await wide.evaluate(() => ((window as unknown as { __marker: number }).__marker = 42));
  await wide.setViewportSize({ width: 1600, height: 1000 });
  await expect(root).toHaveAttribute("data-format", "16:10");
  // Fenêtre en portrait : pas de format portrait, le 4:3 le plus proche avec des bandes noires.
  await wide.setViewportSize({ width: 720, height: 1280 });
  await expect(root).toHaveAttribute("data-format", "4:3");
  const portraitBox = (await root.boundingBox())!;
  expect(portraitBox.width).toBeCloseTo(720, -1);
  expect(portraitBox.height).toBeLessThan(1280 * 0.5);
  expect(await wide.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(marker);
  await expect(wide.locator("[data-total]")).toBeVisible();
  await wide.close();

  // Format imposé par l'URL, quelle que soit la fenêtre.
  const forced = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await forced.goto(`/screen/${s.live.displayToken}?format=21:9`);
  await expect(forced.locator(".show-root")).toHaveAttribute("data-format", "21:9");
  await forced.goto(`/screen/${s.live.displayToken}?format=32x9`);
  await expect(forced.locator(".show-root")).toHaveAttribute("data-format", "32:9");
  await forced.goto(`/screen/${s.live.displayToken}?format=projecteur`);
  await expect(forced.locator(".show-root")).toHaveAttribute("data-format", "4:3");
  // Valeurs inconnues ou retirées (portrait) : détection automatique (16:10 pour 1440 × 900).
  for (const value of ["9:16", "portrait", "5:4"]) {
    await forced.goto(`/screen/${s.live.displayToken}?format=${value}`);
    await expect(forced.locator(".show-root")).toHaveAttribute("data-format", "16:10");
  }
  await forced.close();
});

test("catégories de donateurs : bandeau au-dessus de la liste des dons en 21:9 et 32:9", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const s = state();
  await login(page, s.adminEmail, s.password);
  await page.goto(`/o/${s.orgSlug}/events/new`);
  await page.getByLabel("Nom de l'événement").fill("Gala formats E2E");
  await page.getByLabel("Objectif financier").fill("50000");
  for (const [i, name] of ["Parrains", "Familles", "Amis"].entries()) {
    await page.getByRole("button", { name: "Ajouter une catégorie" }).click();
    await page.getByLabel(`Nom de la catégorie ${i + 1}`).fill(name);
  }
  await page.getByRole("button", { name: "Créer l'événement" }).click();
  await expect(page.getByRole("heading", { name: "Gala formats E2E" })).toBeVisible({ timeout: 30_000 });
  const screenUrl = new URL((await page.locator("code", { hasText: "/screen/" }).textContent())!.trim()).pathname;
  await page.getByRole("button", { name: "Lancer un test" }).click();
  await expect(page.getByText(/Mode test\s?: répétez toute la soirée/)).toBeVisible();

  for (const [format, viewport, width] of [
    ["21:9", { width: 1260, height: 540 }, 2520],
    ["32:9", { width: 1920, height: 540 }, 3840],
  ] as const) {
    const screen = await browser.newPage({ viewport });
    await screen.goto(screenUrl);
    await expect(screen.locator(".show-root")).toHaveAttribute("data-format", format);
    const categories = screen.locator("[data-categories]");
    await expect(categories).toBeVisible();
    await expect(screen.locator("[data-category]")).toHaveCount(3);
    await expectCleanLayout(screen, width, 1080, 6);
    // Bandeau juste au-dessus de la liste des dons, de la même largeur, catégories côte à côte.
    const band = (await categories.boundingBox())!;
    const list = (await screen.getByText("Dernières promesses").locator("xpath=ancestor::div[contains(@class,'show-panel')][1]").boundingBox())!;
    expect(Math.abs(band.x - list.x)).toBeLessThan(4);
    expect(Math.abs(band.width - list.width)).toBeLessThan(4);
    expect(band.y + band.height).toBeLessThanOrEqual(list.y + 1);
    expect(band.width / band.height).toBeGreaterThan(2.4);
    if (process.env.E2E_SCREENSHOTS) {
      await screen.waitForTimeout(3200);
      await screen.screenshot({ path: `${dir}/30-format-categories-${format.replace(":", "x")}.png` });
    }
    await screen.close();
  }
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
  await page.locator("textarea").first().fill("Merci à tous pour votre générosité ce soir !");

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
      await screen.screenshot({ path: `${dir}/28-format-${theme}-${f.id.replace(":", "x")}.png` });
      await screen.close();
    }
  }

  // Retour à l'état initial : sans texte, arrière-plan Gala Premium.
  await page.getByRole("tab", { name: "Textes" }).click();
  await page.locator("textarea").first().fill("");
  await saveDesign(page);
});
