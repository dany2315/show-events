import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { fillRegieDonor, money, state } from "./helpers";

/**
 * Mode démo (DEMO_MODE=1). Lancement : `E2E_DEMO=1 npx playwright test demo`
 * (le serveur de test démarre alors en mode démo, avec une limite de 4 espaces par heure et par IP).
 * Sans E2E_DEMO, seul le test « mode démo désactivé » s'exécute (suite normale).
 */
const DEMO = process.env.E2E_DEMO === "1";
const dir = "tests/e2e/__screens__";
const shots = Boolean(process.env.E2E_SCREENSHOTS);
/** Total des 15 promesses du gala de démonstration (FR, en euros). */
const DEMO_TOTAL = 36_460;

test.describe("mode démo désactivé", () => {
  test.skip(DEMO, "serveur lancé en mode démo");

  test("les routes de démo renvoient 404 et l'accueil reste inchangé", async ({ page, request }) => {
    expect((await request.get("/demo")).status()).toBe(404);
    expect((await request.get("/api/cron/demo-cleanup", { headers: { authorization: "Bearer x" } })).status()).toBe(404);
    const home = await page.goto("/");
    expect(home?.status()).toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator("[data-demo-start]")).toHaveCount(0);
    await page.goto("/login");
    await expect(page.locator("[data-login-demo]")).toHaveCount(0);
  });
});

test.describe("mode démo", () => {
  test.skip(!DEMO, "E2E_DEMO=1 requis");

  const slugs = new Set<string>();

  test.afterAll(async () => {
    if (slugs.size === 0) return;
    const sql = neon(process.env.DATABASE_URL!);
    const list = [...slugs];
    await sql`DELETE FROM "user" WHERE id IN (
      SELECT m."userId" FROM "membership" m JOIN "organization" o ON o.id = m."organizationId"
      WHERE o.slug = ANY(${list}) AND o."isDemo" = true)`;
    await sql`DELETE FROM "organization" WHERE slug = ANY(${list}) AND "isDemo" = true`;
  });

  /** Chaque visiteur simulé a sa propre adresse IP (limite de créations par IP). */
  function fakeIp() {
    const n = () => Math.floor(Math.random() * 250) + 1;
    return `10.${n()}.${n()}.${n()}`;
  }

  async function visitor(browser: Browser, ip = fakeIp()) {
    return browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": ip }, locale: "fr-FR", viewport: { width: 1440, height: 900 } });
  }

  async function startDemo(page: Page, from = "/") {
    await page.goto(from);
    await page.locator("[data-demo-start]").first().click();
    await page.waitForURL(/\/o\/demo-[0-9a-f]+/, { timeout: 45_000 });
    const slug = new URL(page.url()).pathname.split("/")[2]!;
    slugs.add(slug);
    return slug;
  }

  async function regieUrl(page: Page) {
    const href = await page.locator("[data-demo-step-regie]").getAttribute("href");
    expect(href).toMatch(/\/events\/[^/]+\/regie$/);
    return href!;
  }

  test("« Essayer la démo » ouvre une console connectée, sans identifiants, avec un gala prêt", async ({ browser }) => {
    const context = await visitor(browser);
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator("[data-demo-start]").first()).toBeVisible();
    if (shots) await page.screenshot({ path: `${dir}/40-demo-accueil.png` });

    await startDemo(page);
    expect(new URL(page.url()).pathname).not.toBe("/login");
    await expect(page.locator("[data-demo-bar]")).toBeVisible();
    await expect(page.locator("[data-demo-guide]")).toBeVisible();
    await expect(page.getByText("Gala de démonstration").first()).toBeVisible();
    await expect(page.locator("[data-demo-guide] [data-demo-qr]")).toBeVisible();
    if (shots) await page.screenshot({ path: `${dir}/41-demo-tableau-de-bord.png`, fullPage: true });

    // Aucun mot de passe : la page du compte l'indique.
    await page.goto("/account");
    await expect(page.locator("[data-demo-account]")).toBeVisible();
    await context.close();
  });

  test("Régie de démo : promesses, catégories, vidéos, ajout visible à l'écran et simulation", async ({ browser }) => {
    const context = await visitor(browser);
    const page = await context.newPage();
    await startDemo(page);
    const screenUrl = await page.locator("[data-demo-step-screen]").getAttribute("href");
    const regie = await regieUrl(page);
    const eventId = regie.split("/")[4]!;
    await page.goto(regie);

    await expect(page.locator("[data-regie-categories] [data-category-total]")).toHaveCount(3);
    await expect(page.getByText("Famille Cohen").first()).toBeVisible();
    await expect(page.locator("[data-video-item]")).toHaveCount(2);
    await expect(page.locator("[data-demo-video-note]")).toBeVisible();
    await expect(page.getByRole("button", { name: "Importer un fichier" })).toHaveCount(0);

    const screen = await context.newPage();
    await screen.goto(screenUrl!);
    await expect(screen.locator("[data-total]")).toHaveText(money(DEMO_TOTAL), { timeout: 20_000 });

    await fillRegieDonor(page, "Alice", "Démo");
    await page.getByLabel("Montant", { exact: true }).fill("1000");
    await page.getByRole("button", { name: /Ajouter au show/ }).click();
    await expect(screen.locator("[data-total]")).toHaveText(money(DEMO_TOTAL + 1000), { timeout: 20_000 });
    await expect(screen.getByText("Alice Démo").first()).toBeVisible({ timeout: 20_000 });

    await page.locator("[data-demo-simulate]").click();
    await expect(page.locator("[data-demo-simulate-progress]")).toBeVisible();
    await expect(page.getByText(/Simulation terminée : 6 promesses ajoutées/)).toBeVisible({ timeout: 60_000 });
    await expect(page.locator("[data-demo-simulate]")).toBeVisible();
    // 15 promesses de départ + 1 saisie + 6 simulées, toutes affichées sur l'écran.
    const sql = neon(process.env.DATABASE_URL!);
    const [row] = await sql`SELECT "liveCount", "liveTotal" FROM "event" WHERE id = ${eventId}`;
    expect(row.liveCount).toBe(22);
    await expect(screen.locator("[data-total]")).toHaveText(money(row.liveTotal as number), { timeout: 20_000 });
    if (shots) await page.screenshot({ path: `${dir}/42-demo-regie.png`, fullPage: true });
    if (shots) {
      await screen.waitForTimeout(2500);
      await screen.screenshot({ path: `${dir}/43-demo-ecran.png` });
    }
    await context.close();
  });

  test("« Recommencer la démo » prépare un espace neuf et l'ancien n'est plus accessible", async ({ browser }) => {
    const context = await visitor(browser);
    const page = await context.newPage();
    const first = await startDemo(page);
    await page.locator("[data-demo-restart]").click();
    await page.locator("[data-demo-restart-confirm]").click();
    await page.waitForURL((url) => /\/o\/demo-[0-9a-f]+/.test(url.pathname) && !url.pathname.includes(first), { timeout: 45_000 });
    const second = new URL(page.url()).pathname.split("/")[2]!;
    slugs.add(second);
    expect(second).not.toBe(first);
    await expect(page.locator("[data-demo-guide]")).toBeVisible();
    const response = await page.goto(`/o/${first}`);
    expect(response?.status()).toBe(404);
    await context.close();
  });

  test("en hébreu, le gala de démonstration est préparé en hébreu et en shekels", async ({ browser }) => {
    const context = await visitor(browser);
    await context.addCookies([{ name: "fl_locale", value: "he", url: test.info().project.use.baseURL! }]);
    const page = await context.newPage();
    await startDemo(page);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("[data-demo-guide]")).toBeVisible();
    await expect(page.getByText("ערב התרמה – הדגמה").first()).toBeVisible();
    await expect(page.getByText(/₪/).first()).toBeVisible();
    if (shots) await page.screenshot({ path: `${dir}/45-demo-tableau-de-bord-he.png` });
    await context.close();
  });

  test("isolation : un visiteur ne voit ni l'espace d'un autre, ni les associations ordinaires, ni le Super Admin", async ({ browser }) => {
    const a = await visitor(browser);
    const b = await visitor(browser);
    const pageA = await a.newPage();
    const pageB = await b.newPage();
    await startDemo(pageA);
    const slugB = await startDemo(pageB);
    const regieB = await regieUrl(pageB);
    const eventB = regieB.split("/")[4]!;

    expect((await pageA.goto(`/o/${slugB}`))?.status()).toBe(404);
    expect((await pageA.goto(regieB))?.status()).toBe(404);
    expect((await pageA.request.get(`/api/events/${eventB}/donations`)).status()).toBe(404);
    expect((await pageA.goto(`/o/${state().orgSlug}`))?.status()).toBe(404);
    expect((await pageA.goto("/admin"))?.status()).toBe(404);
    await a.close();
    await b.close();
  });

  test("garde-fous : page de démo, tâche de nettoyage protégée, limite de créations par IP", async ({ browser, request }) => {
    expect((await request.get("/api/cron/demo-cleanup")).status()).toBe(401);
    const cron = await request.get("/api/cron/demo-cleanup", { headers: { authorization: "Bearer e2e-cron-secret" } });
    expect(cron.status()).toBe(200);
    expect(await cron.json()).toMatchObject({ ok: true });

    const ip = fakeIp();
    const context: BrowserContext = await visitor(browser, ip);
    const page = await context.newPage();
    await page.goto("/demo");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (shots) await page.screenshot({ path: `${dir}/44-demo-page.png`, fullPage: true });
    // Limite de test : 4 espaces par heure et par IP (DEMO_SPACES_PER_HOUR).
    for (let i = 0; i < 4; i++) {
      await context.clearCookies();
      await startDemo(page, "/demo");
    }
    await context.clearCookies();
    await page.goto("/demo");
    await page.locator("[data-demo-start]").first().click();
    await page.waitForURL(/\/demo\?erreur=limite/, { timeout: 45_000 });
    await expect(page.locator("[data-demo-error]")).toBeVisible();
    await context.close();
  });
});
