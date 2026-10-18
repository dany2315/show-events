import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";

type EventTokens = { id: string; formToken: string; displayToken: string };
export type E2EState = {
  stamp: string;
  orgId: string;
  orgSlug: string;
  adminEmail: string;
  password: string;
  live: EventTokens;
  ended: EventTokens;
  concurrency: EventTokens[];
  wifi: EventTokens;
  rehearsal: EventTokens;
};

export function state(): E2EState {
  return JSON.parse(readFileSync("tests/e2e/.state.json", "utf8"));
}

export async function login(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  // /app redirige ensuite vers l'espace de l'utilisateur (Super Admin ou association)
  await page.waitForURL((url) => !["/login", "/app"].includes(url.pathname), { timeout: 30_000 });
  await page.waitForLoadState("networkidle");
}

/** Les montants sont formatés avec des espaces insécables : on compare sur les chiffres. */
export function money(amount: number) {
  const digits = amount.toLocaleString("fr-FR").replace(/[\s  ]/g, "\\s?");
  return new RegExp(`${digits}\\s?€`);
}

export function key() {
  return `e2e${Date.now()}${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Champs « donateur » d'une promesse envoyée par l'API publique : « Prénom Nom » → prénom, nom, téléphone.
 * Le nom affiché sur l'écran est alors exactement `name` (un nom d'un seul mot reçoit le nom « Test »).
 */
export function publicDonor(name: string, extra: { phone?: string; email?: string; anonymous?: boolean } = {}) {
  const [firstName, ...rest] = name.split(" ");
  return { firstName, lastName: rest.join(" ") || "Test", phone: extra.phone ?? "+33 6 00 00 00 00", ...extra };
}

/** Saisie du donateur dans la Régie. */
export async function fillRegieDonor(page: Page, firstName: string, lastName: string) {
  await page.getByLabel("Prénom", { exact: true }).fill(firstName);
  await page.getByLabel("Nom", { exact: true }).fill(lastName);
}

/** Saisie du donateur sur le formulaire mobile. */
export async function fillPublicDonor(page: Page, firstName: string, lastName: string, phone = "+33 6 12 34 56 78") {
  await page.getByLabel("Prénom", { exact: true }).fill(firstName);
  await page.getByLabel("Nom", { exact: true }).fill(lastName);
  await page.getByLabel("Téléphone", { exact: true }).fill(phone);
}

export async function expectTotalOnScreen(page: Page, amount: number) {
  await expect(page.locator("[data-total]")).toHaveText(money(amount), { timeout: 20_000 });
}
