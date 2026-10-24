import { describe, expect, test } from "vite-plus/test";
import { createIngredientsList } from "../src/core/ingredients.ts";
import { createDeclaration } from "../src/output/declaration.ts";
import type { Ingredient } from "../src/types/index.ts";

const g = (name: string, quantity: number, extra: Partial<Ingredient> = {}): Ingredient => ({
  name,
  quantity,
  unit: "weight",
  ...extra,
});

const allergensOf = (ingredients: Ingredient[]) =>
  Object.fromEntries(createIngredientsList(ingredients).map((item) => [item.name, item.allergens]));

// Annex II No 12: more than 10 mg/kg SO2 in the product as eaten.
describe("sulphite from amounts", () => {
  test("below 10 mg/kg it is no allergen", () => {
    // 50 g at 150 mg/kg = 7.5 mg in 1 kg
    expect(allergensOf([g("Weizenmehl", 950), g("Weißwein", 50, { sulphite: 150 })])).toEqual({
      Weizenmehl: ["gluten"],
      Weißwein: [],
    });
  });

  test("above 10 mg/kg the raw material that brings it gets the allergen", () => {
    // 100 g at 150 mg/kg = 15 mg in 1 kg
    expect(allergensOf([g("Weizenmehl", 900), g("Weißwein", 100, { sulphite: 150 })])).toEqual({
      Weizenmehl: ["gluten"],
      Weißwein: ["sulphites"],
    });
  });

  test("exactly 10 mg/kg is not more than 10", () => {
    expect(allergensOf([g("Wasser", 900), g("Weißwein", 100, { sulphite: 100 })]).Weißwein).toEqual(
      [],
    );
  });

  test("sources add up, each one gets the allergen", () => {
    // 6 mg + 5 mg = 11 mg in 1 kg
    expect(
      allergensOf([
        g("Wasser", 950),
        g("Weißwein", 40, { sulphite: 150 }),
        g("Rosinen", 10, { sulphite: 500 }),
      ]),
    ).toEqual({ Wasser: [], Weißwein: ["sulphites"], Rosinen: ["sulphites"] });
  });

  test("nested sources count, and a group carries the allergen of its parts", () => {
    const [group] = createIngredientsList([
      g("Füllung", 600, {
        group: true,
        children: [g("Wasser", 500), g("Weißwein", 100, { sulphite: 150 })],
      }),
      g("Wasser", 400),
    ]);
    // 15 mg in 1 kg
    expect(group?.allergens).toEqual(["sulphites"]);
    expect(group?.children?.find((child) => child.name === "Weißwein")?.allergens).toEqual([
      "sulphites",
    ]);
  });

  test("the same raw material from two levels is added up before the check", () => {
    // 60 mg/kg on 2 x 100 g = 12 mg in 1 kg; one part alone would be 6 mg
    expect(
      allergensOf([
        g("Wasser", 800),
        g("Weißwein", 100, { sulphite: 60 }),
        g("Teig", 100, { children: [g("Weißwein", 100, { sulphite: 60 })] }),
      ]).Weißwein,
    ).toEqual(["sulphites"]);
  });

  test("a raw material with 0 mg/kg brings none, even when others push the product over", () => {
    expect(
      allergensOf([
        g("Wasser", 800),
        g("Weißwein", 100, { sulphite: 150 }),
        g("Apfelsaft", 100, { sulphite: 0 }),
      ]).Apfelsaft,
    ).toEqual([]);
  });

  test("the word always wins: named sulphur dioxide is an allergen whatever the amount", () => {
    expect(allergensOf([g("Wasser", 999), g("Schwefeldioxid", 1)]).Schwefeldioxid).toEqual([
      "sulphites",
    ]);
  });
});

describe("sulphite in the declaration", () => {
  test("a name that does not say it gets the allergen in brackets", () => {
    expect(createDeclaration([g("Wasser", 900), g("Glukosesirup", 100, { sulphite: 150 })])).toBe(
      "Wasser, Glukosesirup (SULFITE)",
    );
  });

  test("below the limit nothing is added", () => {
    expect(createDeclaration([g("Wasser", 950), g("Glukosesirup", 50, { sulphite: 150 })])).toBe(
      "Wasser, Glukosesirup",
    );
  });

  test("a name that says it is highlighted, not repeated", () => {
    expect(
      createDeclaration([g("Wasser", 999), g("Natriumsulfit", 1, { sulphite: 1000000 })]),
    ).toBe("Wasser, NATRIUMSULFIT");
  });
});

describe("wine", () => {
  test("its sulphite comes from what the baker passes in, as amount or as its ingredients", () => {
    expect(createDeclaration([g("Wasser", 900), g("Weißwein", 100, { sulphite: 150 })])).toBe(
      "Wasser, Weißwein (SULFITE)",
    );
    expect(
      createDeclaration([
        g("Wasser", 900),
        g("Rotwein", 100, {
          group: true,
          children: [
            g("Wein", 99.9, { unit: "percent" }),
            g("Schwefeldioxid", 0.1, { unit: "percent" }),
          ],
        }),
      ]),
    ).toBe("Wasser, Rotwein (Wein, SCHWEFELDIOXID)");
  });
});

describe("invalid amounts are refused", () => {
  test.each([-1, Number.NaN, Number.POSITIVE_INFINITY])("%s", (sulphite) => {
    expect(() =>
      createIngredientsList([g("Wasser", 900), g("Weißwein", 100, { sulphite })]),
    ).toThrow(
      expect.objectContaining({
        diagnostics: [expect.objectContaining({ code: "sulphite.invalid", path: "[1]" })],
      }),
    );
  });
});

describe("amount on the raw material or from its parts", () => {
  const wine = (extra: Partial<Ingredient>, children: Ingredient[]) =>
    g("Rotwein", 100, { ...extra, children });
  const p = (name: string, quantity: number, extra: Partial<Ingredient> = {}): Ingredient => ({
    name,
    quantity,
    unit: "percent",
    ...extra,
  });

  test("on the raw material: it counts for all of it, also when resolved", () => {
    expect(createDeclaration([g("Wasser", 900), wine({ sulphite: 150 }, [p("Wein", 100)])])).toBe(
      "Wasser, Wein (SULFITE)",
    );
  });

  test("on the raw material, shown as a group", () => {
    expect(
      createDeclaration([g("Wasser", 900), wine({ sulphite: 150, group: true }, [p("Wein", 100)])]),
    ).toBe("Wasser, Rotwein (Wein (SULFITE))");
  });

  test("a part that only names it is no second amount", () => {
    expect(
      createDeclaration([
        g("Wasser", 900),
        wine({ sulphite: 150, group: true }, [p("Wein", 99.9), p("Schwefeldioxid", 0.1)]),
      ]),
    ).toBe("Wasser, Rotwein (Wein (SULFITE), SCHWEFELDIOXID)");
  });

  test("the raw material's own amount covers everything below it, nothing is counted twice", () => {
    // 100 g at 100 mg/kg = 10 mg in 1 kg, exactly the limit; the wine inside is part of it
    expect(
      allergensOf([
        g("Wasser", 900),
        g("Aprikosenfüllung", 100, {
          sulphite: 100,
          children: [p("Wein", 100, { sulphite: 5000 })],
        }),
      ]).Wein,
    ).toEqual([]);
  });
});
