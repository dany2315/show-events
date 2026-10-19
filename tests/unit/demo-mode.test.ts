import { afterEach, describe, expect, it } from "vitest";
import { DEMO_EMAIL_DOMAIN, demoSpacesPerHour, isDemoEmail, isDemoMode } from "@/lib/demo-mode";
import { checkGoLive } from "@/lib/billing";

const saved = { mode: process.env.DEMO_MODE, perHour: process.env.DEMO_SPACES_PER_HOUR };

function restore(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

afterEach(() => {
  restore("DEMO_MODE", saved.mode);
  restore("DEMO_SPACES_PER_HOUR", saved.perHour);
});

describe("mode démo", () => {
  it("n'est actif qu'avec DEMO_MODE=1 (ou true)", () => {
    delete process.env.DEMO_MODE;
    expect(isDemoMode()).toBe(false);
    process.env.DEMO_MODE = "";
    expect(isDemoMode()).toBe(false);
    process.env.DEMO_MODE = "0";
    expect(isDemoMode()).toBe(false);
    process.env.DEMO_MODE = "1";
    expect(isDemoMode()).toBe(true);
    process.env.DEMO_MODE = "true";
    expect(isDemoMode()).toBe(true);
  });

  it("reconnaît les comptes de démonstration par leur domaine réservé", () => {
    expect(isDemoEmail(`visiteur-abc@${DEMO_EMAIL_DOMAIN}`)).toBe(true);
    expect(isDemoEmail(`VISITEUR@${DEMO_EMAIL_DOMAIN.toUpperCase()}`)).toBe(true);
    expect(isDemoEmail("admin@espoir.test")).toBe(false);
    expect(isDemoEmail(`x@evil-${DEMO_EMAIL_DOMAIN}`)).toBe(false);
    expect(isDemoEmail(null)).toBe(false);
  });

  it("limite de créations par heure : 10 par défaut, réglable", () => {
    delete process.env.DEMO_SPACES_PER_HOUR;
    expect(demoSpacesPerHour()).toBe(10);
    process.env.DEMO_SPACES_PER_HOUR = "3";
    expect(demoSpacesPerHour()).toBe(3);
    process.env.DEMO_SPACES_PER_HOUR = "-2";
    expect(demoSpacesPerHour()).toBe(10);
  });

  it("le gala de démo en direct ne consomme aucun crédit (abonnement mensuel)", () => {
    const sub = { plan: "PRO_MONTHLY" as const, status: "ACTIVE" as const, eventCredits: 0, currentPeriodEnd: new Date(Date.now() + 864e5) };
    expect(checkGoLive(sub, true, false)).toEqual({ allowed: true, consumesCredit: false });
  });
});
