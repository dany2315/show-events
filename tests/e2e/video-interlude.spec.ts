import { expect, test, type Page } from "@playwright/test";
import { key, login, money, publicDonor, state } from "./helpers";

const LONG = "tests/e2e/fixtures/interlude-long.mp4"; // 20 s
const SHORT = "tests/e2e/fixtures/interlude-short.mp4"; // 3 s
const shot = (page: Page, name: string) => (process.env.E2E_SCREENSHOTS ? page.screenshot({ path: `tests/e2e/__screens__/${name}.png` }) : Promise.resolve(Buffer.alloc(0)));

/**
 * Intermède vidéo piloté depuis la Régie : vidéos préparées (fichiers importés), lien collé en direct,
 * lecture plein écran sur l'écran géant, promesses en arrière-plan, récapitulatif au retour, droits.
 */
test.describe.serial("intermède vidéo", () => {
  test("préparer, lancer, promesse en arrière-plan, arrêter, fin naturelle, lien en direct", async ({ page, browser, request }) => {
    test.setTimeout(240_000);
    const s = state();
    await login(page, s.adminEmail, s.password);
    await page.goto(`/o/${s.orgSlug}/events/${s.live.id}/regie`);
    const panel = page.locator("[data-video-panel]");
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Aucune vidéo préparée")).toBeVisible();

    // ─── Préparer 2 vidéos (fichiers importés), renommer, réordonner ───
    await page.locator("#video-title").fill("Film long");
    await page.locator("[data-video-file]").setInputFiles(LONG);
    await expect(page.locator('[data-video-item="Film long"]')).toBeVisible({ timeout: 30_000 });
    await page.locator("#video-title").fill("Clip");
    await page.locator("[data-video-file]").setInputFiles(SHORT);
    await expect(page.locator('[data-video-item="Clip"]')).toBeVisible({ timeout: 30_000 });
    const clip = page.locator('[data-video-item="Clip"]');
    await clip.getByRole("button", { name: "Renommer" }).click();
    await clip.getByRole("textbox").fill("Clip court");
    await clip.getByRole("textbox").press("Enter");
    const short = page.locator('[data-video-item="Clip court"]');
    await expect(short).toBeVisible();
    await short.getByRole("button", { name: "Monter" }).click();
    await expect(page.locator("[data-video-item]").first()).toHaveAttribute("data-video-item", "Clip court");
    await page.locator('[data-video-item="Clip court"]').getByRole("button", { name: "Descendre" }).click();
    await expect(page.locator("[data-video-item]").first()).toHaveAttribute("data-video-item", "Film long");
    // La liste est enregistrée : elle survit au rechargement de la Régie.
    await page.reload();
    await expect(page.locator("[data-video-item]")).toHaveCount(2);
    await expect(page.locator("[data-video-item]").nth(1)).toHaveAttribute("data-video-item", "Clip court");
    // Le panneau tient dans sa colonne (380 px sur grand écran), sans déborder.
    expect((await page.locator("[data-video-panel]").boundingBox())!.width).toBeLessThanOrEqual(381);
    await page.locator("[data-video-panel]").scrollIntoViewIfNeeded();
    await shot(page, "31-regie-videos-preparees");

    // ─── Écran géant ouvert, pas encore « armé » (aucun clic) ───
    const screen = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await screen.goto(`/screen/${s.live.displayToken}`);
    await expect(screen.locator("[data-total]")).toBeVisible();
    await expect(screen.locator("[data-enable-sound]")).toBeVisible();
    await screen.waitForTimeout(1500);

    // ─── Lancer le film (avec le son) ───
    await page.getByRole("button", { name: "Lancer Film long" }).click();
    const interlude = screen.locator("[data-video-interlude]");
    await expect(interlude).toBeVisible({ timeout: 20_000 });
    await expect(interlude).toHaveAttribute("data-video-state", "playing");
    // Plein écran, au-dessus de toute la scène.
    const box = (await interlude.boundingBox())!;
    expect(Math.round(box.width)).toBe(1920);
    expect(Math.round(box.height)).toBe(1080);
    const covered = await screen.evaluate(() =>
      [
        [960, 540],
        [60, 60],
        [1860, 60],
        [60, 1020],
        [1860, 1020],
      ].every(([x, y]) => Boolean(document.elementFromPoint(x, y)?.closest("[data-video-interlude]"))),
    );
    expect(covered).toBe(true);
    await expect
      .poll(() => interlude.locator("video").evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime > 0.2), { timeout: 20_000 })
      .toBe(true);

    // Son refusé tant que personne n'a cliqué sur l'écran : lecture muette, signalée à la Régie.
    await expect(interlude).toHaveAttribute("data-video-muted", "true");
    const active = page.locator("[data-video-active]");
    await expect(active).toContainText("Vidéo en cours : Film long");
    await expect(page.locator("[data-video-sound-blocked]")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("[data-preview-video]")).toContainText("Film long");

    // Un clic sur « Activer le son » arme l'écran : le son est rétabli et la Régie en est informée.
    await screen.mouse.move(400, 400);
    await screen.locator("[data-enable-sound]").click();
    await expect(screen.locator("[data-enable-sound]")).toHaveCount(0);
    await expect(interlude).toHaveAttribute("data-video-muted", "false");
    await expect(page.locator("[data-video-sound-blocked]")).toHaveCount(0, { timeout: 20_000 });
    await expect(screen.locator("[data-video-interlude] video")).toHaveJSProperty("muted", false);

    // Couper le son / le rétablir depuis la Régie, sans relancer la vidéo.
    await active.getByRole("button", { name: "Couper le son" }).click();
    await expect(interlude).toHaveAttribute("data-video-muted", "true", { timeout: 20_000 });
    await expect(page.locator('[data-video-sound="off"]')).toBeVisible();
    await active.getByRole("button", { name: "Rétablir le son" }).click();
    await expect(interlude).toHaveAttribute("data-video-muted", "false", { timeout: 20_000 });
    expect(await screen.locator("[data-video-interlude] video").evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(1);

    // ─── Promesse pendant la vidéo : total à jour en arrière-plan, sans projecteur par-dessus ───
    const before = (await (await request.get(`/api/live/screen/${s.live.displayToken}`)).json()) as { total: number };
    const res = await request.post(`/api/d/${s.live.formToken}`, {
      data: { ...publicDonor("Pendant Intermède"), amount: 777, idempotencyKey: key() },
      headers: { "x-forwarded-for": "10.77.7.7" },
    });
    expect(res.status()).toBe(200);
    await expect(screen.locator("[data-total]")).toHaveText(money(before.total + 777), { timeout: 20_000 });
    await expect(screen.locator("[data-card]")).toHaveCount(0);
    await expect(interlude).toBeVisible();
    await expect(page.locator("[data-video-elapsed]")).toHaveText(/^\d+:\d{2}$/);
    await shot(screen, "32-ecran-intermede-video");
    await page.locator("[data-preview-video]").scrollIntoViewIfNeeded();
    await shot(page, "33-regie-video-en-cours");

    // ─── Arrêter : retour à la scène avec le récapitulatif ───
    await active.getByRole("button", { name: "Arrêter la vidéo" }).click();
    const recap = screen.locator("[data-video-recap]");
    await expect(recap).toBeVisible({ timeout: 20_000 });
    await expect(recap).toContainText("Pendant la vidéo");
    await expect(recap).toContainText("1 nouvelle promesse");
    await expect(recap).toContainText(money(777));
    await expect(interlude).toHaveCount(0);
    await screen.waitForTimeout(900);
    await shot(screen, "34-ecran-recap-apres-video");
    await expect(active).toHaveCount(0);
    await expect(recap).toHaveCount(0, { timeout: 15_000 });

    // ─── Fin naturelle du fichier : retour automatique, Régie notifiée ───
    await page.getByRole("button", { name: "Lancer Clip court" }).click();
    await expect(interlude).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("[data-video-active]")).toContainText("Clip court");
    await expect(interlude).toHaveCount(0, { timeout: 25_000 });
    await expect(page.locator("[data-video-active]")).toHaveCount(0, { timeout: 20_000 });
    await expect(screen.locator("[data-video-recap]")).toHaveCount(0); // aucune promesse pendant le clip

    // ─── Lien collé en temps réel ───
    const link = page.locator("[data-video-launch-link]");
    await page.locator("#video-live-url").fill("https://exemple.org/page.html");
    await link.getByRole("button", { name: "Lancer", exact: true }).click();
    await expect(page.locator("[data-video-link-error]")).toContainText("Lien non reconnu");
    await page.locator("#video-live-url").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    await link.getByRole("button", { name: "Lancer", exact: true }).click();
    await expect(screen.locator('[data-video-interlude] iframe[src*="youtube-nocookie.com/embed/dQw4w9WgXcQ"]')).toBeAttached({ timeout: 20_000 });
    await expect(page.locator("[data-video-active]")).toContainText("YouTube");
    await page.locator("[data-video-active]").getByRole("button", { name: "Arrêter la vidéo" }).click();
    await expect(interlude).toHaveCount(0, { timeout: 20_000 });

    // ─── Suppression d'une vidéo préparée ───
    await page.locator('[data-video-item="Clip court"]').getByRole("button", { name: "Supprimer la vidéo" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Supprimer" }).click();
    await expect(page.locator("[data-video-item]")).toHaveCount(1);
    await screen.close();
  });

  test("droits : seuls les membres de l'association pilotent l'intermède", async ({ browser, request }) => {
    const s = state();
    // Sans session
    const anonymous = await request.post(`/api/events/${s.live.id}/control`, { data: { action: "videoStart", url: "https://youtu.be/dQw4w9WgXcQ" } });
    expect(anonymous.status()).toBe(401);

    // Utilisateur Show d'une autre association
    const outsider = await browser.newPage();
    await login(outsider, s.outsiderEmail, s.password);
    const denied = await outsider.request.post(`/api/events/${s.live.id}/control`, { data: { action: "videoStart", url: "https://youtu.be/dQw4w9WgXcQ" } });
    expect(denied.status()).toBe(404);
    const stop = await outsider.request.post(`/api/events/${s.live.id}/control`, { data: { action: "videoStop" } });
    expect(stop.status()).toBe(404);
    await outsider.goto(`/o/${s.orgSlug}/events/${s.live.id}/regie`);
    await expect(outsider.getByText("Page introuvable")).toBeVisible();
    await outsider.close();

    // Rien n'a été lancé
    const snap = (await (await request.get(`/api/live/screen/${s.live.displayToken}`)).json()) as { control: { video?: unknown } };
    expect(snap.control.video ?? null).toBeNull();

    // Signalements de l'écran : lien de diffusion obligatoire, sans effet sur un autre intermède.
    expect((await request.post(`/api/live/screen/lien-invalide-0000000000000/video`, { data: { action: "ended", runId: "x" } })).status()).toBe(404);
    const stale = await request.post(`/api/live/screen/${s.live.displayToken}/video`, { data: { action: "ended", runId: "inconnu" } });
    expect(stale.status()).toBe(200);
    expect((await stale.json()).changed).toBe(false);
  });

  test("badge MODE TEST : ne recouvre aucun bloc (21:9, 32:9, 16:9)", async ({ browser }) => {
    const s = state();
    for (const [name, width, height] of [
      ["21x9", 1680, 720],
      ["32x9", 1920, 540],
      ["16x9", 1600, 900],
    ] as const) {
      const screen = await browser.newPage({ viewport: { width, height } });
      await screen.goto(`/screen/${s.rehearsal.displayToken}`);
      const badge = screen.locator("[data-screen-badge]");
      await expect(badge).toHaveText("MODE TEST");
      await screen.waitForTimeout(3000); // commandes de l'écran masquées après inactivité
      const clash = await badge.evaluate((el) => {
        const b = el.getBoundingClientRect();
        // Le texte tient dans le badge
        if (el.scrollWidth > el.clientWidth + 1) return "texte coupé";
        for (const block of Array.from(document.querySelectorAll("[data-block]"))) {
          const r = block.getBoundingClientRect();
          if (b.left < r.right && r.left < b.right && b.top < r.bottom && r.top < b.bottom) return block.getAttribute("data-block");
        }
        return null;
      });
      expect(clash, name).toBeNull();
      if (name !== "16x9") await shot(screen, `35-badge-mode-test-${name}`);
      await screen.close();
    }
  });
});
