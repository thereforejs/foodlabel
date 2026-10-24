import { describe, expect, test } from "vite-plus/test";
import { collectTraces, selectTraces } from "../src/core/traces.ts";
import { createTraces } from "../src/output/traces.ts";
import type { Ingredient } from "../src/types/index.ts";

const g = (name: string, quantity: number, extra: Partial<Ingredient> = {}): Ingredient => ({
  name,
  quantity,
  unit: "weight",
  ...extra,
});

const names = (ingredients: Ingredient[]) =>
  collectTraces(ingredients).map((trace) => [trace.name, trace.allergens]);

describe("collectTraces", () => {
  test("from every level of the recipe", () => {
    expect(
      names([
        g("Weizenmehl", 900, { traces: ["Sesam"] }),
        g("Glasur", 100, {
          children: [g("Zucker", 60, { traces: ["Haselnüsse", "Milch"] }), g("Kakaobutter", 40)],
        }),
      ]),
    ).toEqual([
      ["Sesam", ["sesame"]],
      ["Haselnüsse", ["nuts"]],
      ["Milch", ["milk"]],
    ]);
  });

  test("the general group word is fine here, unlike in the ingredient list", () => {
    expect(names([g("Weizenmehl", 1, { traces: ["Schalenfrüchte"] })])).toEqual([
      ["Schalenfrüchte", ["nuts"]],
    ]);
  });

  test("an unknown word is refused with its path", () => {
    expect(() =>
      collectTraces([g("Wasser", 1), g("Glasur", 1, { traces: ["Sesam", "Buchweizen"] })]),
    ).toThrow(
      expect.objectContaining({
        diagnostics: [expect.objectContaining({ code: "trace.unknown", path: "[1].traces[1]" })],
      }),
    );
  });

  test("a word without allergen is no trace", () => {
    expect(() => collectTraces([g("Wasser", 1, { traces: ["Zucker"] })])).toThrow(
      expect.objectContaining({
        diagnostics: [expect.objectContaining({ code: "trace.noAllergen", path: "[0].traces[0]" })],
      }),
    );
  });
});

const selected = (ingredients: Ingredient[]) =>
  selectTraces(ingredients).map((trace) => trace.name);

describe("selectTraces", () => {
  test("each word once, however it is written", () => {
    expect(
      selected([
        g("Wasser", 50, { traces: ["Sesam"] }),
        g("Zucker", 50, { traces: ["SESAM", "Soja"] }),
      ]),
    ).toEqual(["Soja", "Sesam"]);
  });

  test("in the order of Annex II", () => {
    expect(selected([g("Zucker", 1, { traces: ["Sesam", "Haselnüsse", "Milch"] })])).toEqual([
      "Milch",
      "Haselnüsse",
      "Sesam",
    ]);
  });

  test("an allergen that is an ingredient is no trace", () => {
    expect(selected([g("Butter", 50), g("Zucker", 50, { traces: ["Milch", "Sesam"] })])).toEqual([
      "Sesam",
    ]);
  });

  test("for nuts and cereals the kind counts", () => {
    expect(
      selected([
        g("Walnüsse", 30),
        g("Weizenmehl", 60),
        g("Zucker", 10, { traces: ["Walnüsse", "Haselnüsse", "Weizen", "Roggen"] }),
      ]),
    ).toEqual(["Roggen", "Haselnüsse"]);
  });

  test("singular and plural are the same kind", () => {
    expect(
      selected([
        g("Haselnusskerne", 30),
        g("Mandeln", 30),
        g("Zucker", 40, { traces: ["Haselnüsse", "Mandel", "Walnüsse"] }),
      ]),
    ).toEqual(["Walnüsse"]);
  });
});

describe("createTraces", () => {
  test("one statement below the list, without what the list already names", () => {
    expect(
      createTraces([g("Butter", 50), g("Zucker", 50, { traces: ["Sesam", "Milch", "Soja"] })]),
    ).toBe("Kann Spuren enthalten: SOJA, SESAM.");
  });

  test("nothing to state: empty", () => {
    expect(createTraces([g("Butter", 50, { traces: ["Milch"] })])).toBe("");
  });

  test("highlighted like the ingredient list", () => {
    expect(
      createTraces([g("Zucker", 1, { traces: ["Haselnüsse", "Sojamehl"] })], {
        format: "markdown",
        highlight: "bold",
        highlightScope: "allergen",
      }),
    ).toBe("Kann Spuren enthalten: **Soja**mehl, **Haselnüsse**.");
  });
});
