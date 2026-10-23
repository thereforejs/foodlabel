import { decimal, equals, toDecimalString } from "@thereforejs/decy";
import { describe, expect, test } from "vite-plus/test";
import { createIngredientsList } from "../src/core/ingredients.ts";
import type { Ingredient, ResolvedIngredient } from "../src/types/index.ts";

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

const sourdough = (group: boolean, quantity = 1000): Ingredient => ({
  name: "Sauerteig",
  quantity,
  unit: "weight",
  group,
  children: [
    { name: "Roggenmehl", quantity: 50, unit: "percent" },
    { name: "Wasser", quantity: 50, unit: "percent" },
  ],
});

type Tree = [string, string, Tree[]?];
const tree = (items: ResolvedIngredient[]): Tree[] =>
  items.map((item) =>
    item.children
      ? [item.name, toDecimalString(item.weight), tree(item.children)]
      : [item.name, toDecimalString(item.weight)],
  );

describe("grouping", () => {
  test("a group stays one entry and is not merged with the outside", () => {
    const result = createIngredientsList([
      { name: "Roggenmehl", quantity: 5000, unit: "weight" },
      sourdough(true),
      { name: "Wasser", quantity: 5300, unit: "weight" },
    ]);
    expect(tree(result)).toEqual([
      ["Wasser", "5300"],
      ["Roggenmehl", "5000"],
      [
        "Sauerteig",
        "1000",
        [
          ["Roggenmehl", "500.00"],
          ["Wasser", "500.00"],
        ],
      ],
    ]);
    expect(result[2]?.allergens).toEqual(["gluten"]);
  });

  test("groups of the same name stay apart", () => {
    expect(
      createIngredientsList([sourdough(true), sourdough(true, 500)]).map((item) => item.name),
    ).toEqual(["Sauerteig", "Sauerteig"]);
  });

  test("the product itself is never its own bracket", () => {
    expect(tree(createIngredientsList([sourdough(true)]))).toEqual([
      ["Roggenmehl", "500.00"],
      ["Wasser", "500.00"],
    ]);
  });

  test("groups nest", () => {
    const result = createIngredientsList([
      { name: "Salz", quantity: 100, unit: "weight" },
      {
        name: "Backmittel",
        quantity: 2000,
        unit: "weight",
        group: true,
        children: [{ ...sourdough(true, 100), unit: "percent" }],
      },
    ]);
    expect(tree(result)).toEqual([
      [
        "Backmittel",
        "2000",
        [
          [
            "Sauerteig",
            "2000.00",
            [
              ["Roggenmehl", "1000.0000"],
              ["Wasser", "1000.0000"],
            ],
          ],
        ],
      ],
      ["Salz", "100"],
    ]);
  });

  test("a group carries the allergens and unknown names of its parts", () => {
    const [, group] = createIngredientsList([
      { name: "Salz", quantity: 100, unit: "weight" },
      {
        name: "Mischung",
        quantity: 50,
        unit: "weight",
        group: true,
        children: [
          { name: "Sesam", quantity: 20, unit: "weight" },
          { name: "Weizenmehl", quantity: 20, unit: "weight" },
          { name: "Lecithin", quantity: 10, unit: "weight" },
        ],
      },
    ]);
    expect(group).toMatchObject({ allergens: ["gluten", "sesame"], unknown: ["lecithin"] });
  });
});
