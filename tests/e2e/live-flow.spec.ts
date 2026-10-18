import { expect, test, type Page } from "@playwright/test";
import { expectTotalOnScreen, login, money, state } from "./helpers";

test.describe.configure({ mode: "serial" });

test.describe("parcours d'une soirée : régie, écran géant, mobile, studio, équipe", () => {
  let screen: Page;
  let base = 0;

  test.beforeAll(async ({ browser, request }) => {
    const s = state();
    const snap = await (await request.get(`/api/live/screen/${s.live.displayToken}`)).json();
    base = snap.total;
    screen = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await screen.goto(`/screen/${s.live.displayToken}`);
    await expectTotalOnScreen(screen, base);
  });

  test.afterAll(async () => {
    await screen?.close();
  });

  test("l'administrateur voit l'événement en direct sur son tableau de bord", async ({ page }) => {
    const s = state();
    await login(page, s.adminEmail, s.password);
    await expect(page).toHaveURL(new RegExp(`/o/${s.orgSlug}$`));
    await expect(page.getByText("Événement en cours")).toBeVisible();
    await expect(page.getByRole("link", { name: "Gala E2E" })).toBeVisible();
  });

  test("régie : promesse réelle puis don fictif, total public incluant les deux", async ({ page }) => {
    const s = state();
    await login(page, s.adminEmail, s.password);
    await page.goto(`/o/${s.orgSlug}/events/${s.live.id}/regie`);
    await expect(page.getByRole("heading", { name: "Ajouter une promesse" })).toBeVisible();

    await page.getByLabel("Nom du donateur").fill("Famille Test");
    await page.getByLabel("Montant", { exact: true }).fill("1000");
    await page.getByRole("button", { name: /Ajouter au show/ }).click();
    await expect(page.getByText(/Famille Test · .*ajouté au show/)).toBeVisible();
    await expectTotalOnScreen(screen, base + 1000);

    await page.getByLabel("Nom du donateur").fill("Démo fictive");
    await page.getByRole("button", { name: "+500 €" }).click();
    await page.getByRole("switch", { name: "Don fictif" }).click();
    await page.getByRole("button", { name: /Ajouter au show/ }).click();
    await expect(page.getByText(/Démo fictive · .*ajouté au show/)).toBeVisible();

    // Le public voit le don fictif exactement comme un don réel, et le total l'inclut
    await expectTotalOnScreen(screen, base + 1500);
    await expect(screen.getByText("Démo fictive")).toBeVisible();
    // La régie l'identifie comme fictif
    await expect(page.locator("li", { hasText: "Démo fictive" }).getByText("Fictif")).toBeVisible();
    // Le switch « Don fictif » est revenu décoché
    await expect(page.getByRole("switch", { name: "Don fictif" })).toHaveAttribute("aria-checked", "false");
  });

  test("formulaire mobile : la promesse apparaît immédiatement sur l'écran", async ({ browser }) => {
    const s = state();
    const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await phone.goto(`/d/${s.live.formToken}`);
    await expect(phone.getByRole("heading", { name: "Gala E2E" })).toBeVisible();
    await phone.getByPlaceholder("Ex. Famille Cohen").fill("Mobile Tester");
    await phone.getByRole("button", { name: "100 €", exact: true }).click();
    await phone.getByRole("button", { name: /Envoyer ma promesse/ }).click();
    await expect(phone.getByRole("heading", { name: "Merci Mobile Tester !" })).toBeVisible();
    await phone.close();

    await expectTotalOnScreen(screen, base + 1600);
    await expect(screen.getByText("Mobile Tester")).toBeVisible();
  });

  test("régie : correction puis suppression d'une promesse, écrans recalculés", async ({ page }) => {
    const s = state();
    await login(page, s.adminEmail, s.password);
    await page.goto(`/o/${s.orgSlug}/events/${s.live.id}/regie`);

    const row = page.locator("li", { hasText: "Famille Test" });
    await row.getByRole("button", { name: "Modifier" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Montant/).fill("1200");
    await dialog.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Promesse corrigée")).toBeVisible();
    await expectTotalOnScreen(screen, base + 1800);

    await page.locator("li", { hasText: "Démo fictive" }).getByRole("button", { name: "Supprimer" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Supprimer" }).click();
    await expect(page.getByText("Promesse supprimée")).toBeVisible();
    await expectTotalOnScreen(screen, base + 1300);
    await expect(screen.getByText("Démo fictive")).toHaveCount(0);
  });

  test("régie : message à l'écran et retrait", async ({ page }) => {
    const s = state();
    await login(page, s.adminEmail, s.password);
    await page.goto(`/o/${s.orgSlug}/events/${s.live.id}/regie`);
    await page.getByLabel("Message à l'écran").fill("Merci à tous !");
    await page.getByRole("button", { name: "Afficher" }).click();
    await expect(screen.getByText("Merci à tous !")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Retirer le message" }).click();
    await expect(screen.getByText("Merci à tous !")).toHaveCount(0, { timeout: 20_000 });
  });

  test("studio : changement de style enregistré et diffusé sur l'écran", async ({ page }) => {
    const s = state();
    await login(page, s.adminEmail, s.password);
    await page.goto(`/o/${s.orgSlug}/events/${s.live.id}/studio`);
    await page.getByRole("tab", { name: "Style" }).click();
    // Bibliothèque d'arrière-plans : plus aucun import de fond personnalisé
    await expect(page.getByText("Arrière-plan", { exact: true })).toBeVisible();
    await expect(page.getByText("Couleur de fond")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Importer", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Nature" }).click();
    await expect(page.getByRole("button", { name: "Nature" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Modifications non enregistrées")).toBeVisible();
    await page.getByRole("button", { name: /Enregistrer le design/ }).click();
    await expect(page.getByText("Design enregistré et diffusé sur les écrans")).toBeVisible();
    await expect
      .poll(async () => screen.locator(".show-root").first().evaluate((el) => getComputedStyle(el).getPropertyValue("--show-accent").trim()), { timeout: 20_000 })
      .toBe("#a6e35f");
    await expect(screen.locator('[data-backdrop="nature"]')).toHaveCount(1);
  });

  test("studio : mise en page intelligente diffusée sur l'écran", async ({ page }) => {
    const s = state();
    await login(page, s.adminEmail, s.password);
    await page.goto(`/o/${s.orgSlug}/events/${s.live.id}/studio`);
    await page.getByRole("tab", { name: "Éléments" }).click();
    // La mise en page de l'écran ne propose plus de vidéo (ni bloc, ni mise en page dédiée)
    await expect(page.getByRole("button", { name: /^Vidéo/ })).toHaveCount(0);
    await expect(page.getByText("Vidéo à la une")).toHaveCount(0);

    // Chevauchement créé à la main, détecté puis corrigé
    await page.getByRole("button", { name: /^QR code Accès au formulaire/ }).click();
    const props = page.locator("aside").last();
    await props.getByLabel("X (%)").fill("37");
    await expect(page.getByText(/chevauchement\(s\) détecté\(s\)/)).toBeVisible();
    await page.getByRole("button", { name: "Corriger", exact: true }).click();
    await expect(page.getByText("Aucun chevauchement")).toBeVisible();

    // Mise en page « Donateurs à l'honneur », puis disposition automatique adaptée à 12 dons affichés
    await page.getByRole("button", { name: "Donateurs à l'honneur", exact: true }).click();
    await page.getByRole("button", { name: "Disposition automatique" }).click();
    await expect(page.getByText("Mise en page « Donateurs à l'honneur » appliquée")).toBeVisible();
    await expect(page.getByText("Aucun chevauchement")).toBeVisible();

    await page.getByRole("button", { name: /Enregistrer le design/ }).click();
    await expect(page.getByText("Design enregistré et diffusé sur les écrans")).toBeVisible();
    // Sur l'écran, la liste des dons passe sur le bord gauche (lecture de gauche à droite)
    await expect
      .poll(async () => (await screen.getByText("Dernières promesses").boundingBox())?.x ?? Infinity, { timeout: 20_000 })
      .toBeLessThan(400);
    // Aucune vidéo sur l'écran ; le fond reste le décor de la bibliothèque
    await expect(screen.locator("iframe, video")).toHaveCount(0);
    await expect(screen.locator("[data-backdrop]")).toHaveCount(1);
  });

  test("écran : montant de l'objectif seul, sans barre de progression ni pourcentage", async () => {
    const goal = screen.locator("[data-goal]");
    await expect(goal).toBeVisible();
    await expect(goal).toContainText("Objectif");
    await expect(goal).toContainText(money(10_000));
    await expect(goal).not.toContainText("%");
    await expect(screen.locator(".show-bar-fill, [role='progressbar']")).toHaveCount(0);
    await expect(screen.locator(".show-root").getByText(/\d\s?%/)).toHaveCount(0);
    if (process.env.E2E_SCREENSHOTS) {
      await screen.waitForTimeout(1500);
      await screen.screenshot({ path: "tests/e2e/__screens__/14-ecran-objectif.png" });
    }
  });

  test("médias : import d'une vidéo MP4 et lecture par plages (Safari / iPhone)", async ({ page }) => {
    const s = state();
    await login(page, s.adminEmail, s.password);
    // En-tête MP4 minimal (boîte « ftyp ») suivi de données.
    const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom"), Buffer.alloc(2048, 7)]);
    const upload = await page.request.post("/api/media", {
      multipart: { organizationId: s.orgId, file: { name: "clip.mp4", mimeType: "video/mp4", buffer: mp4 } },
    });
    expect(upload.status()).toBe(201);
    const { url } = await upload.json();
    const partial = await page.request.get(url, { headers: { range: "bytes=0-11" } });
    expect(partial.status()).toBe(206);
    expect(partial.headers()["content-range"]).toBe(`bytes 0-11/${mp4.length}`);
    expect(partial.headers()["content-type"]).toBe("video/mp4");
    expect((await partial.body()).toString("latin1", 4, 8)).toBe("ftyp");
    // Un faux fichier vidéo est refusé
    const fake = await page.request.post("/api/media", {
      multipart: { organizationId: s.orgId, file: { name: "x.mp4", mimeType: "video/mp4", buffer: Buffer.from("<script>alert(1)</script>") } },
    });
    expect(fake.status()).toBe(400);
  });

  test("fiche événement : sous-totaux réels / fictifs et export CSV", async ({ page }) => {
    const s = state();
    await login(page, s.adminEmail, s.password);
    await page.goto(`/o/${s.orgSlug}/events/${s.live.id}`);
    await expect(page.getByText("Total du show")).toBeVisible();
    await expect(page.getByText("Dons fictifs")).toBeVisible();
    await expect(page.getByText(money(base + 1300)).first()).toBeVisible();
    const csv = await page.request.get(`/api/events/${s.live.id}/export`);
    expect(csv.status()).toBe(200);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    expect(await csv.text()).toContain("Famille Test");
  });

  test("équipe : création d'un Utilisateur Show à accès limité", async ({ page, browser }) => {
    const s = state();
    await login(page, s.adminEmail, s.password);
    await page.goto(`/o/${s.orgSlug}/team`);
    await page.getByRole("button", { name: "Ajouter un membre" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nom").fill("Opérateur E2E");
    const email = `operateur-${s.stamp}@e2e.test`;
    await dialog.getByLabel("E-mail").fill(email);
    await dialog.getByRole("button", { name: "Ajouter un membre" }).click();
    const credentials = page.getByRole("dialog", { name: "Identifiants à transmettre" });
    await expect(credentials).toBeVisible();
    const password = (await credentials.locator("code").textContent())!.trim();
    expect(password).toHaveLength(12);

    const operator = await browser.newPage();
    await login(operator, email, password);
    await expect(operator).toHaveURL(new RegExp(`/o/${s.orgSlug}$`));
    await expect(operator.getByRole("heading", { name: "Mes événements" })).toBeVisible();
    await expect(operator.getByText("Régie Live").first()).toBeVisible();
    // Pas d'accès à la gestion de l'association
    await operator.goto(`/o/${s.orgSlug}/settings`);
    await expect(operator).toHaveURL(new RegExp(`/o/${s.orgSlug}$`));
    await operator.goto(`/o/${s.orgSlug}/team`);
    await expect(operator).toHaveURL(new RegExp(`/o/${s.orgSlug}$`));
    expect((await operator.request.get(`/api/events/${s.live.id}/export`)).status()).toBe(403);
    // Mais accès à la régie
    expect((await operator.request.get(`/api/events/${s.live.id}/donations`)).status()).toBe(200);
    // Isolation multi-associations
    await operator.goto("/o/espoir-pour-demain");
    await expect(operator.getByText("Page introuvable")).toBeVisible();
    await operator.close();
  });

  test("isolation : un administrateur ne voit pas les données d'une autre association", async ({ page, request }) => {
    const s = state();
    await login(page, s.adminEmail, s.password);
    const res = await page.request.get(`/api/live/event/${s.concurrency[0].id}`);
    expect(res.status()).toBe(200); // sa propre association
    const other = await page.request.post(`/api/events/inexistant-ou-autre-asso/donations`, {
      data: { donorName: "Intrus", amount: 10, idempotencyKey: "abcdefgh12345" },
    });
    expect(other.status()).toBe(404);
    expect((await request.get(`/api/events/${s.live.id}/donations`)).status()).toBe(401);
  });
});
