import { describe, expect, it } from "vitest";
import { fr } from "@/i18n/fr";
import { he } from "@/i18n/he";
import { fmt } from "@/i18n/format";
import { campaignUrlSchema, isSafeWebUrl, manualDonationSchema, publicDonationSchema, slugify, slugSchema } from "@/lib/validation";
import { deriveAccessToken, generateTempPassword, hashToken, newAccessId } from "@/lib/tokens";

function leaves(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
}

describe("traductions français / hébreu", () => {
  it("les deux langues ont exactement les mêmes clés", () => {
    expect(leaves(he).sort()).toEqual(leaves(fr).sort());
  });
  it("aucune traduction vide", () => {
    const check = (obj: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === "string") expect(v.trim(), k).not.toBe("");
        else if (v && typeof v === "object" && !Array.isArray(v)) check(v as Record<string, unknown>);
      }
    };
    check(fr);
    check(he);
  });
  it("les variables {x} sont conservées en hébreu", () => {
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    const walk = (a: Record<string, unknown>, b: Record<string, unknown>) => {
      for (const k of Object.keys(a)) {
        // En hébreu, le singulier s'écrit sans chiffre (« חבר אחד ») : seules les clés _one peuvent omettre {count}.
        if (typeof a[k] === "string" && k.endsWith("_one")) expect(vars(a[k] as string), k).toContain(vars(b[k] as string));
        else if (typeof a[k] === "string") expect(vars(b[k] as string), k).toBe(vars(a[k] as string));
        else if (a[k] && typeof a[k] === "object" && !Array.isArray(a[k])) walk(a[k] as Record<string, unknown>, b[k] as Record<string, unknown>);
      }
    };
    walk(fr, he);
  });
  it("interpole les variables", () => {
    expect(fmt("Merci {name} !", { name: "Sarah" })).toBe("Merci Sarah !");
  });
});

describe("validation", () => {
  const donor = { firstName: "Sarah", lastName: "Cohen", phone: "+33 6 12 34 56 78" };
  it("valide une promesse publique", () => {
    expect(publicDonationSchema.safeParse({ ...donor, amount: "500", idempotencyKey: "abcdef123456" }).success).toBe(true);
    expect(publicDonationSchema.safeParse({ ...donor, firstName: "", amount: 500, idempotencyKey: "abcdef123456" }).success).toBe(false);
    expect(publicDonationSchema.safeParse({ ...donor, lastName: " ", amount: 500, idempotencyKey: "abcdef123456" }).success).toBe(false);
    expect(publicDonationSchema.safeParse({ ...donor, amount: 0, idempotencyKey: "abcdef123456" }).success).toBe(false);
    expect(publicDonationSchema.safeParse({ ...donor, amount: 5, idempotencyKey: "<script>" }).success).toBe(false);
  });
  it("formulaire public : téléphone obligatoire et normalisé, e-mail facultatif mais valide", () => {
    const parsed = publicDonationSchema.parse({ ...donor, email: "  Sarah@Exemple.FR ", amount: 500, idempotencyKey: "abcdef123456" });
    expect(parsed.phone).toBe("+33612345678");
    expect(parsed.email).toBe("sarah@exemple.fr");
    expect(parsed.anonymous).toBe(false);
    expect(publicDonationSchema.parse({ ...donor, email: "", amount: 5, idempotencyKey: "abcdef123456" }).email).toBeUndefined();
    expect(publicDonationSchema.safeParse({ firstName: "Sarah", lastName: "Cohen", amount: 5, idempotencyKey: "abcdef123456" }).success).toBe(false);
    expect(publicDonationSchema.safeParse({ ...donor, phone: "abc", amount: 5, idempotencyKey: "abcdef123456" }).success).toBe(false);
    expect(publicDonationSchema.safeParse({ ...donor, email: "pas-un-email", amount: 5, idempotencyKey: "abcdef123456" }).success).toBe(false);
    expect(publicDonationSchema.safeParse({ ...donor, firstName: "x".repeat(41), amount: 5, idempotencyKey: "abcdef123456" }).success).toBe(false);
  });
  it("Régie : téléphone et e-mail facultatifs, nom facultatif seulement pour un anonyme", () => {
    const parsed = manualDonationSchema.parse({ firstName: "David", lastName: "Lévy", phone: "", email: "", amount: 100, idempotencyKey: "abcdef123456" });
    expect(parsed.isFictitious).toBe(false);
    expect(parsed.phone).toBeUndefined();
    expect(manualDonationSchema.safeParse({ firstName: "David", amount: 100, idempotencyKey: "abcdef123456" }).success).toBe(false);
    expect(manualDonationSchema.safeParse({ anonymous: true, amount: 100, idempotencyKey: "abcdef123456" }).success).toBe(true);
    expect(manualDonationSchema.safeParse({ firstName: "D", lastName: "L", phone: "12", amount: 100, idempotencyKey: "abcdef123456" }).success).toBe(false);
  });
  it("lien de la campagne : http(s) uniquement, facultatif", () => {
    expect(campaignUrlSchema.parse("https://exemple.org/campagne?ref=gala")).toBe("https://exemple.org/campagne?ref=gala");
    expect(campaignUrlSchema.parse("http://exemple.org")).toBe("http://exemple.org");
    expect(campaignUrlSchema.parse("")).toBeNull();
    expect(campaignUrlSchema.parse(undefined)).toBeNull();
    for (const bad of ["javascript:alert(1)", "data:text/html,<b>x</b>", "ftp://exemple.org", "exemple.org", "https://user:pw@exemple.org", "https://"]) {
      expect(campaignUrlSchema.safeParse(bad).success, bad).toBe(false);
      expect(isSafeWebUrl(bad), bad).toBe(false);
    }
  });
  it("génère des identifiants d'URL propres", () => {
    expect(slugify("Espoir pour Demain — Gala 2026 !")).toBe("espoir-pour-demain-gala-2026");
    expect(slugSchema.safeParse("ok-slug-1").success).toBe(true);
    expect(slugSchema.safeParse("Pas OK").success).toBe(false);
  });
});

describe("jetons d'accès", () => {
  it("dérive un jeton stable et non devinable, stocké uniquement sous forme d'empreinte", () => {
    const id = newAccessId();
    const token = deriveAccessToken(id);
    expect(token).toHaveLength(26);
    expect(deriveAccessToken(id)).toBe(token);
    expect(deriveAccessToken(newAccessId())).not.toBe(token);
    expect(hashToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken(token)).not.toContain(token);
  });
  it("génère des mots de passe provisoires sans caractères ambigus", () => {
    const pw = generateTempPassword();
    expect(pw).toHaveLength(12);
    expect(pw).not.toMatch(/[0O1lI]/);
  });
});
