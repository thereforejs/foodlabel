import { decimal, equals, toDecimalString } from "@jasy/decy";
import { describe, expect, test } from "vite-plus/test";
import { createIngredientsList } from "../src/core/ingredients.ts";
import type { Ingredient } from "../src/types/index.ts";

const recipe: Ingredient[] = [
  { name: "Roggenmehl", quantity: 5000, unit: "weight" },
  { name: "Weizenmehl", quantity: 3000, unit: "weight" },
  {
    name: "Sauerteig",
    quantity: 1000,
    unit: "weight",
    children: [
      { name: "Roggenmehl", quantity: 50, unit: "percent" },
      { name: "Wasser", quantity: 50, unit: "percent" },
    ],
  },
  { name: "Salz", quantity: 190, unit: "weight" },
  {
    name: "Backmittel",
    quantity: 250,
    unit: "weight",
    children: [
      { name: "Weizenerzeugnisse", quantity: 85, unit: "percent" },
      { name: "Malze", quantity: 12, unit: "percent" },
      { name: "Glukose-Fructose-Sirup", quantity: 3, unit: "percent" },
    ],
  },
  { name: "Wasser", quantity: 5300, unit: "weight" },
];

const rows = (ingredients: Ingredient[]) =>
  createIngredientsList(ingredients).map((item) => ({
    name: item.name,
    weight: toDecimalString(item.weight),
    allergens: item.allergens,
  }));

describe("createIngredientsList", () => {
  test("first recipe: resolved to grams, merged, heaviest first", () => {
    const result = createIngredientsList(recipe);
    expect(result.map((item) => [item.name, item.allergens])).toEqual([
      ["Wasser", []],
      ["Roggenmehl", ["gluten"]],
      ["Weizenmehl", ["gluten"]],
      ["Weizenerzeugnisse", ["gluten"]],
      ["Salz", []],
      ["Malze", ["gluten"]],
      ["Glukose-Fructose-Sirup", []],
    ]);
    const grams = ["5800", "5500", "3000", "212.5", "190", "30", "7.5"].map((text) =>
      decimal(text),
    );
    expect(result.map((item, index) => equals(item.weight, grams[index]!))).toEqual(
      grams.map(() => true),
    );
  });

  test("nesting is resolved top down", () => {
    expect(
      rows([
        {
          name: "Backmittel",
          quantity: 1000,
          unit: "weight",
          children: [
            {
              name: "Mischung",
              quantity: 10,
              unit: "percent",
              children: [{ name: "Salz", quantity: 100, unit: "percent" }],
            },
            { name: "Weizenmehl", quantity: 90, unit: "percent" },
          ],
        },
      ]).map((row) => [row.name, row.weight]),
    ).toEqual([
      ["Weizenmehl", "900.00"],
      ["Salz", "100.0000"],
    ]);
  });

  test("same name is merged across levels, case and spacing ignored", () => {
    expect(
      rows([
        { name: "Wasser", quantity: 10, unit: "weight" },
        {
          name: "Teig",
          quantity: 20,
          unit: "weight",
          children: [{ name: " WASSER", quantity: 100, unit: "percent" }],
        },
      ]).map((row) => row.name),
    ).toEqual(["Wasser"]);
  });

  test("children must add up to their parent", () => {
    expect(() =>
      createIngredientsList([
        {
          name: "Backmittel",
          quantity: 250,
          unit: "weight",
          children: [{ name: "Malze", quantity: 90, unit: "percent" }],
        },
      ]),
    ).toThrow("[0].children");
  });

  test("a percentage needs a parent", () => {
    expect(() => createIngredientsList([{ name: "Salz", quantity: 2, unit: "percent" }])).toThrow(
      "[0]",
    );
  });
});
