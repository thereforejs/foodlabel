import { describe, expect, test } from "vite-plus/test";
import * as foodlabel from "../src/index.ts";
import { createDeclaration, createIngredientsList, type Ingredient } from "../src/index.ts";

const bread: Ingredient[] = [
  { name: "Roggenmehl", quantity: 600, unit: "weight", quid: true },
  {
    name: "Sauerteig",
    quantity: 400,
    unit: "weight",
    children: [
      { name: "Roggenmehl", quantity: 50, unit: "percent" },
      { name: "Wasser", quantity: 50, unit: "percent" },
    ],
  },
];

describe("public api", () => {
  test("only what callers need is exported", () => {
    expect(Object.keys(foodlabel).sort()).toEqual([
      "DiagnosticError",
      "createDeclaration",
      "createIngredientsList",
    ]);
  });

  test("declaration from the outside", () => {
    expect(createDeclaration(bread)).toBe("80 % ROGGENMEHL, Wasser");
  });

  test("structured list from the outside", () => {
    expect(createIngredientsList(bread).map((item) => item.name)).toEqual(["Roggenmehl", "Wasser"]);
  });
});
