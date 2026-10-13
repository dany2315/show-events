import { describe, expect, it } from "vitest";
import { fr } from "@/i18n/fr";
import { he } from "@/i18n/he";
import { fmt } from "@/i18n/format";
import { manualDonationSchema, publicDonationSchema, slugify, slugSchema } from "@/lib/validation";
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
  it("valide une promesse publique", () => {
    expect(publicDonationSchema.safeParse({ donorName: "Famille Cohen", amount: "500", idempotencyKey: "abcdef123456" }).success).toBe(true);
    expect(publicDonationSchema.safeParse({ donorName: "", amount: 500, idempotencyKey: "abcdef123456" }).success).toBe(false);
    expect(publicDonationSchema.safeParse({ donorName: "A", amount: 0, idempotencyKey: "abcdef123456" }).success).toBe(false);
    expect(publicDonationSchema.safeParse({ donorName: "A", amount: 5, idempotencyKey: "<script>" }).success).toBe(false);
  });
  it("le don fictif est décoché par défaut", () => {
    const parsed = manualDonationSchema.parse({ donorName: "Test", amount: 100, idempotencyKey: "abcdef123456" });
    expect(parsed.isFictitious).toBe(false);
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
