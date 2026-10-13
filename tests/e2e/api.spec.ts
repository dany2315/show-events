import { randomBytes } from "node:crypto";
import { expect, request as playwrightRequest, test } from "@playwright/test";
import { key, state } from "./helpers";

type Snapshot = { total: number; count: number; seq: number; donations: { id: string; donorName: string; amount: number }[] };

test.describe("formulaire mobile et synchronisation (API)", () => {
  test("une promesse mobile est immédiatement visible par l'écran, sans validation", async ({ request }) => {
    const s = state();
    const before = (await (await request.get(`/api/live/screen/${s.live.displayToken}`)).json()) as Snapshot;
    const res = await request.post(`/api/d/${s.live.formToken}`, {
      data: { donorName: "Promesse API", amount: 321, idempotencyKey: key() },
      headers: { "x-forwarded-for": "10.0.0.1" },
    });
    expect(res.status()).toBe(200);
    const events = await (await request.get(`/api/live/screen/${s.live.displayToken}?after=${before.seq}`)).json();
    expect(events.mode).toBe("events");
    const created = events.messages.find((m: { type: string }) => m.type === "donation.created");
    expect(created.donation.donorName).toBe("Promesse API");
    expect(created.total).toBe(before.total + 321);
    // Le public ne voit jamais l'indicateur réel / fictif
    expect(JSON.stringify(events)).not.toContain("isFictitious");
  });

  test("idempotence : un double envoi ne crée qu'une promesse", async ({ request }) => {
    const s = state();
    const k = key();
    const body = { donorName: "Double clic", amount: 50, idempotencyKey: k };
    const [a, b] = await Promise.all([
      request.post(`/api/d/${s.live.formToken}`, { data: body, headers: { "x-forwarded-for": "10.0.0.2" } }),
      request.post(`/api/d/${s.live.formToken}`, { data: body, headers: { "x-forwarded-for": "10.0.0.2" } }),
    ]);
    expect(a.ok() && b.ok()).toBeTruthy();
    const snap = (await (await request.get(`/api/live/screen/${s.live.displayToken}`)).json()) as Snapshot;
    expect(snap.donations.filter((d) => d.donorName === "Double clic")).toHaveLength(1);
  });

  test("champ piège : les robots sont ignorés silencieusement", async ({ request }) => {
    const s = state();
    const res = await request.post(`/api/d/${s.live.formToken}`, {
      data: { donorName: "Robot", amount: 999, idempotencyKey: key(), website: "http://spam" },
      headers: { "x-forwarded-for": "10.0.0.3" },
    });
    expect(res.ok()).toBeTruthy();
    const snap = (await (await request.get(`/api/live/screen/${s.live.displayToken}`)).json()) as Snapshot;
    expect(snap.donations.some((d) => d.donorName === "Robot")).toBe(false);
  });

  test("salle entière derrière un seul Wi-Fi : 150 téléphones, même IP, aucune promesse refusée", async ({ baseURL }) => {
    test.setTimeout(180_000);
    const s = state();
    const ctx = await playwrightRequest.newContext({ baseURL });
    const phones = Array.from({ length: 150 }, (_, i) => ({ device: randomBytes(16).toString("base64url"), i }));
    const responses = await Promise.all(
      phones.map(({ device, i }) =>
        ctx.post(`/api/d/${s.wifi.formToken}`, {
          data: { donorName: `Invité ${i}`, amount: 18, idempotencyKey: key() },
          headers: { "x-forwarded-for": "198.51.100.7", cookie: `fl_device=${device}` },
          timeout: 120_000,
        }),
      ),
    );
    expect(responses.map((r) => r.status()).filter((st) => st !== 200)).toEqual([]);
    await ctx.dispose();
  });

  test("limite anti-abus : 5 promesses par minute et par appareil", async ({ request }) => {
    const s = state();
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await request.post(`/api/d/${s.live.formToken}`, {
        data: { donorName: `Rafale ${i}`, amount: 10, idempotencyKey: key() },
        headers: { "x-forwarded-for": "10.0.0.4" },
      });
      statuses.push(res.status());
    }
    expect(statuses.slice(0, 5).every((st) => st === 200)).toBe(true);
    expect(statuses[5]).toBe(429);
  });

  test("données invalides refusées", async ({ request }) => {
    const s = state();
    for (const data of [
      { donorName: "", amount: 10, idempotencyKey: key() },
      { donorName: "X", amount: -5, idempotencyKey: key() },
      { donorName: "X", amount: 100_000_000, idempotencyKey: key() },
    ]) {
      const res = await request.post(`/api/d/${s.live.formToken}`, { data, headers: { "x-forwarded-for": "10.0.0.5" } });
      expect(res.status()).toBe(400);
    }
  });

  test("collecte terminée : le formulaire refuse les promesses", async ({ request, page }) => {
    const s = state();
    const res = await request.post(`/api/d/${s.ended.formToken}`, { data: { donorName: "Trop tard", amount: 10, idempotencyKey: key() } });
    expect(res.status()).toBe(409);
    await page.goto(`/d/${s.ended.formToken}`);
    await expect(page.getByText("Cette collecte est terminée")).toBeVisible();
  });

  test("charge : 3 galas en parallèle, aucune perte ni doublon, séquence continue", async ({ request }) => {
    test.setTimeout(240_000);
    const s = state();
    const perEvent = 20;
    const amounts = Array.from({ length: perEvent }, (_, i) => 100 + i);
    await Promise.all(
      s.concurrency.flatMap((ev, e) =>
        amounts.map((amount, i) =>
          request.post(`/api/d/${ev.formToken}`, {
            data: { donorName: `Charge ${e}-${i}`, amount, idempotencyKey: key() },
            headers: { "x-forwarded-for": `10.1.${e}.${i}` },
            timeout: 120_000,
          }),
        ),
      ),
    ).then((responses) => responses.forEach((r) => expect(r.status()).toBe(200)));

    const expected = amounts.reduce((a, b) => a + b, 0);
    for (const ev of s.concurrency) {
      const snap = (await (await request.get(`/api/live/screen/${ev.displayToken}`)).json()) as Snapshot;
      expect(snap.total).toBe(expected);
      expect(snap.count).toBe(perEvent);
      const all = await (await request.get(`/api/live/screen/${ev.displayToken}?after=0`)).json();
      const seqs: number[] = all.messages.map((m: { seq: number }) => m.seq);
      // Totaux strictement croissants dans l'ordre de la séquence (verrou par événement)
      const totals: number[] = all.messages.map((m: { total: number }) => m.total);
      expect(totals).toEqual([...totals].sort((a, b) => a - b));
      expect(new Set(seqs).size).toBe(seqs.length);
      expect(totals.at(-1)).toBe(expected);
    }
  });
});
