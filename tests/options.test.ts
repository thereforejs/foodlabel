import { describe, expect, test } from "vite-plus/test";
import { resolveOptions } from "../src/core/options.ts";
import { createIngredientsList } from "../src/core/ingredients.ts";
import type { Ingredient } from "../src/types/index.ts";

const sourdough = (group?: boolean): Ingredient => ({
  name: "Sauerteig",
  quantity: 1000,
  unit: "weight",
  group,
  children: [
    { name: "Roggenmehl", quantity: 50, unit: "percent" },
    { name: "Wasser", quantity: 50, unit: "percent" },
  ],
});
const flour: Ingredient = { name: "Weizenmehl", quantity: 3000, unit: "weight" };

describe("resolveOptions", () => {
  test("defaults", () => {
    expect(resolveOptions()).toEqual({
      jurisdiction: "EU-DE",
      format: "text",
      highlight: "uppercase",
      additives: "name",
      group: false,
      quid: "before",
      percentDecimals: [
        { from: 10, decimals: 0 },
        { from: 1, decimals: 1 },
        { from: 0, decimals: 2 },
      ],
      percentSpace: true,
      rounding: "floor",
    });
  });

  test("given options win", () => {
    expect(
      resolveOptions({ format: "html", highlight: "bold", quid: "brackets-after" }),
    ).toMatchObject({
      format: "html",
      highlight: "bold",
      quid: "brackets-after",
    });
  });

  test("plain text cannot be bold, so the allergen would not stand out", () => {
    expect(() => resolveOptions({ highlight: "bold" })).toThrow("highlight");
  });
});

describe("group default", () => {
  const names = (ingredients: Ingredient[], group?: boolean) =>
    createIngredientsList(ingredients, { group }).map((item) => item.name);

  test("off by default: everything is resolved", () => {
    expect(names([flour, sourdough()])).toEqual(["Weizenmehl", "Roggenmehl", "Wasser"]);
  });

  test("on as default: groups", () => {
    expect(names([flour, sourdough()], true)).toEqual(["Weizenmehl", "Sauerteig"]);
  });

  test("the ingredient setting wins over the default", () => {
    expect(names([flour, sourdough(false)], true)).toEqual(["Weizenmehl", "Roggenmehl", "Wasser"]);
    expect(names([flour, sourdough(true)], false)).toEqual(["Weizenmehl", "Sauerteig"]);
  });

  test("the product itself is never its own bracket, also by default", () => {
    expect(names([sourdough()], true)).toEqual(["Roggenmehl", "Wasser"]);
  });
});
