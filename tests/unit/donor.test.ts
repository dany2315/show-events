import { describe, expect, it } from "vitest";
import { displayDonorName, looksLikeEmail, normalizePhone, splitDonorName } from "@/lib/donor";
import { toPublicDonation } from "@/lib/live/public";

describe("téléphone international souple", () => {
  it.each([
    ["+33 6 12 34 56 78", "+33612345678"],
    ["06 12 34 56 78", "0612345678"],
    ["+972 (54) 123-4567", "+972541234567"],
    ["054-1234567", "0541234567"],
    ["123456", "123456"],
  ])("%s → %s", (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });

  it.each(["", "12345", "1".repeat(21), "06.12.34.56.78", "+33 6 12 34 56 7a", "33+612345678", "<script>"])("refuse « %s »", (raw) => {
    expect(normalizePhone(raw)).toBeNull();
  });
});

describe("identité du donateur", () => {
  it("nom affiché : « Prénom Nom », nettoyé", () => {
    expect(displayDonorName({ firstName: "  Sarah ", lastName: "Cohen" }, "Anonyme")).toBe("Sarah Cohen");
    expect(displayDonorName({ firstName: "<b>Ari</b>", lastName: "Lévy" }, "Anonyme")).toBe("bAri/b Lévy");
  });

  it("anonymat : libellé dans la langue de l'écran", () => {
    expect(displayDonorName({ firstName: "Sarah", lastName: "Cohen", anonymous: true }, "Anonyme")).toBe("Anonyme");
    expect(displayDonorName({ anonymous: true }, "אנונימי")).toBe("אנונימי");
    expect(displayDonorName({ firstName: "", lastName: "" }, "Anonyme")).toBeNull();
  });

  it("limite le nom affiché à 60 caractères", () => {
    expect(displayDonorName({ firstName: "a".repeat(40), lastName: "b".repeat(40) }, "Anonyme")!.length).toBe(60);
  });

  it("e-mail : contrôle côté client", () => {
    expect(looksLikeEmail("sarah@exemple.fr")).toBe(true);
    expect(looksLikeEmail("sarah@exemple")).toBe(false);
    expect(looksLikeEmail("sarah exemple.fr")).toBe(false);
  });

  it("anciennes promesses : prénom / nom proposés à partir du nom affiché", () => {
    expect(splitDonorName("Famille Cohen")).toEqual({ firstName: "Famille", lastName: "Cohen" });
    expect(splitDonorName("Sarah & Michaël Lévy")).toEqual({ firstName: "Sarah", lastName: "& Michaël Lévy" });
    expect(splitDonorName("Robot")).toEqual({ firstName: "Robot", lastName: "" });
  });
});

describe("confidentialité des données diffusées", () => {
  it("une promesse publique ne contient jamais les coordonnées du donateur", () => {
    const row = {
      id: "dn_1",
      donorName: "Sarah Cohen",
      firstName: "Sarah",
      lastName: "Cohen",
      phone: "+33612345678",
      email: "sarah@exemple.fr",
      isFictitious: true,
      amount: 500,
      createdAt: new Date("2026-10-18T20:00:00Z"),
    };
    const shown = toPublicDonation(row);
    expect(Object.keys(shown).sort()).toEqual(["amount", "categoryId", "createdAt", "donorName", "id"]);
    const json = JSON.stringify(shown);
    for (const secret of ["+33612345678", "sarah@exemple.fr", "isFictitious", "phone", "email"]) expect(json).not.toContain(secret);
  });
});
