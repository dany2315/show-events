import { test } from "@playwright/test";
import { login, state } from "./helpers";

/**
 * Captures d'écran de référence (revue visuelle) : npm run test:e2e -- visual
 * Les images sont écrites dans tests/e2e/__screens__/ (ignoré par git).
 */
test.describe.configure({ mode: "serial" });
const dir = "tests/e2e/__screens__";

test("captures des écrans principaux", async ({ browser }) => {
  test.setTimeout(240_000);
  const s = state();

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desktop.goto("/");
  await desktop.waitForTimeout(1500);
  await desktop.screenshot({ path: `${dir}/01-accueil.png` });
  await desktop.screenshot({ path: `${dir}/01b-accueil-complet.png`, fullPage: true });
  await desktop.goto("/login");
  await desktop.screenshot({ path: `${dir}/02-connexion.png` });

  await login(desktop, s.adminEmail, s.password);
  await desktop.waitForTimeout(800);
  await desktop.screenshot({ path: `${dir}/03-tableau-de-bord.png`, fullPage: true });
  await desktop.goto(`/o/${s.orgSlug}/events/${s.live.id}`);
  await desktop.screenshot({ path: `${dir}/04-fiche-evenement.png`, fullPage: true });
  await desktop.goto(`/o/${s.orgSlug}/events/${s.live.id}/regie`);
  await desktop.waitForTimeout(1500);
  await desktop.screenshot({ path: `${dir}/05-regie.png` });
  await desktop.goto(`/o/${s.orgSlug}/events/${s.live.id}/studio`);
  await desktop.waitForTimeout(1500);
  await desktop.screenshot({ path: `${dir}/06-studio.png` });
  await desktop.goto(`/o/${s.orgSlug}/events`);
  await desktop.screenshot({ path: `${dir}/07-evenements.png` });
  await desktop.goto(`/o/${s.orgSlug}/team`);
  await desktop.screenshot({ path: `${dir}/08-equipe.png` });
  await desktop.close();

  const screen = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await screen.goto(`/screen/${s.live.displayToken}`);
  await screen.waitForTimeout(3000);
  await screen.screenshot({ path: `${dir}/09-ecran-geant.png` });
  await screen.close();

  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await phone.goto(`/d/${s.live.formToken}`);
  await phone.waitForTimeout(800);
  await phone.screenshot({ path: `${dir}/10-mobile-formulaire.png`, fullPage: true });
  await phone.getByRole("button", { name: "עברית" }).click();
  await phone.screenshot({ path: `${dir}/11-mobile-hebreu.png`, fullPage: true });
  await phone.goto(`/o/${s.orgSlug}/events/${s.live.id}/regie`);
  await phone.close();

  const mobileRegie = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await login(mobileRegie, s.adminEmail, s.password);
  await mobileRegie.goto(`/o/${s.orgSlug}/events/${s.live.id}/regie`);
  await mobileRegie.waitForTimeout(1000);
  await mobileRegie.screenshot({ path: `${dir}/12-regie-mobile.png`, fullPage: true });
  await mobileRegie.close();

  const superEmail = process.env.SEED_SUPER_ADMIN_EMAIL;
  const superPassword = process.env.SEED_SUPER_ADMIN_PASSWORD;
  if (superEmail && superPassword) {
    const admin = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await login(admin, superEmail, superPassword);
    await admin.screenshot({ path: `${dir}/13-super-admin.png`, fullPage: true });
    await admin.close();
  }
});
