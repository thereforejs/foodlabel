import { describe, expect, test } from "vite-plus/test";
import {
  createDeclaration,
  DiagnosticError,
  type Diagnostic,
  type Ingredient,
} from "../src/index.ts";

const g = (name: string, quantity: number, extra: Partial<Ingredient> = {}): Ingredient => ({
  name,
  quantity,
  unit: "weight",
  ...extra,
});

function diagnosticOf(run: () => unknown): Diagnostic {
  try {
    run();
  } catch (error) {
    if (error instanceof DiagnosticError && error.diagnostics[0]) return error.diagnostics[0];
    throw error;
  }
  throw new Error("expected a DiagnosticError");
}

describe("errors refuse the result with a stable code and the path into the input", () => {
  test.each<[string, Ingredient[], Partial<Diagnostic>]>([
    [
      "percentage without a parent",
      [g("Salz", 2, { unit: "percent" })],
      { code: "share.withoutParent", path: "[0]" },
    ],
    [
      "children that do not add up",
      [g("Backmittel", 250, { children: [g("Malz", 90, { unit: "percent" })] })],
      { code: "share.sumNot100", path: "[0].children", params: { sum: "225.00", expected: "250" } },
    ],
    [
      "unknown additive class",
      [g("Ascorbinsäure", 1, { eNumberCategory: "Vitamin" })],
      {
        code: "additive.functionNotAllowed",
        path: "[0]",
        params: { class: "Vitamin" },
        source: "Regulation (EU) No 1169/2011, Annex VII, Part C",
      },
    ],
    [
      "unknown additive",
      [g("Irgendwas", 1, { eNumberCategory: "Emulgator", eNumber: "E 1234" })],
      { code: "additive.unknown", path: "[0]", params: { name: "E 1234" } },
    ],
    [
      "unknown word",
      [g("Wasser", 90), g("Buchweizen", 10)],
      {
        code: "ingredient.unknown",
        path: "[1]",
        params: { name: "Buchweizen", words: "buchweizen" },
      },
    ],
    [
      "allergen without its kind",
      [g("Wasser", 90), g("Sauerteig", 10, { children: [g("Malz", 100, { unit: "percent" })] })],
      {
        code: "allergen.sourceMissing",
        path: "[1].children[0]",
        params: { name: "Malz", allergen: "gluten" },
      },
    ],
    [
      "share too small to print",
      [g("Wasser", 9999999), g("Sesam", 0.01, { quid: true })],
      { code: "share.belowMinimum", path: "[1]", params: { name: "Sesam" } },
    ],
  ])("%s", (_, ingredients, expected) => {
    expect(diagnosticOf(() => createDeclaration(ingredients))).toMatchObject({
      level: "error",
      ...expected,
    });
  });

  test.each<[string, Parameters<typeof createDeclaration>[1], Partial<Diagnostic>]>([
    [
      "bold in plain text",
      { highlight: "bold" },
      { code: "options.boldNeedsMarkup", path: "options.highlight" },
    ],
    [
      "step set twice",
      {
        percentDecimals: [
          { from: 10, decimals: 0 },
          { from: 10, decimals: 1 },
        ],
      },
      {
        code: "options.percentStepDuplicate",
        path: "options.percentDecimals",
        params: { from: 10 },
      },
    ],
    [
      "step out of range",
      { percentDecimals: [{ from: 101, decimals: 0 }] },
      { code: "options.percentStepOutOfRange", params: { from: 101 } },
    ],
    [
      "too many decimals",
      { percentDecimals: [{ from: 10, decimals: 4 }] },
      { code: "options.percentDecimalsOutOfRange", params: { decimals: 4 } },
    ],
  ])("options: %s", (_, options, expected) => {
    expect(diagnosticOf(() => createDeclaration([g("Wasser", 1)], options))).toMatchObject({
      level: "error",
      ...expected,
    });
  });

  test("the message names path and cause for developers", () => {
    expect(() => createDeclaration([g("Wasser", 90), g("Buchweizen", 10)])).toThrow(
      '[1]: "Buchweizen" has unknown words: buchweizen',
    );
  });
});
