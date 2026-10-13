import { describe, expect, it } from "vitest";
import { formatMoney, goalProgress, parseAmountInput } from "@/lib/money";

const clean = (s: string) => s.replace(/[  ‎‏]/g, " ");

describe("formatMoney", () => {
  it("formate l'euro à la française, sans décimales", () => {
    expect(clean(formatMoney(126000, "EUR", "fr"))).toBe("126 000 €");
  });
  it("formate le shekel en hébreu", () => {
    expect(clean(formatMoney(892000, "ILS", "he"))).toMatch(/892,000/);
    expect(formatMoney(892000, "ILS", "he")).toContain("₪");
  });
  it("formate le dollar", () => {
    expect(formatMoney(1500, "USD", "fr")).toContain("$");
  });
});

describe("parseAmountInput", () => {
  it.each([
    ["1500", 1500],
    ["1 500", 1500],
    ["1.500", 1500],
    ["1,500", 1500],
    ["1500 €", 1500],
    ["₪ 360", 360],
    ["12,5", 13],
    [250, 250],
  ])("%s → %s", (input, expected) => {
    expect(parseAmountInput(input)).toBe(expected);
  });

  it.each(["", "abc", "-50", "0", "1e5", null, undefined, -3])("rejette %s", (input) => {
    expect(parseAmountInput(input as string)).toBeNull();
  });
});

describe("goalProgress", () => {
  it("borne la progression entre 0 et 100", () => {
    expect(goalProgress(50, 200)).toBe(25);
    expect(goalProgress(300, 200)).toBe(100);
    expect(goalProgress(10, 0)).toBe(0);
  });
});
