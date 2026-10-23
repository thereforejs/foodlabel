import fc from "fast-check";
import { describe, expect, test } from "vite-plus/test";
import de from "../src/allergens/de.json" with { type: "json" };
import { ALLERGEN_IDS } from "../src/allergens/ids.ts";
import { createAllergenDetector, normalizeTerm } from "../src/core/allergens.ts";

const detect = createAllergenDetector(de);

describe("vocabulary de", () => {
  test("every term lives in exactly one list", () => {
    const lists = [...ALLERGEN_IDS.map((id) => de.allergens[id].terms), de.neutral];
    const seen = new Map<string, number>();
    for (const term of lists.flat())
      seen.set(normalizeTerm(term), (seen.get(normalizeTerm(term)) ?? 0) + 1);
    expect([...seen].filter(([, count]) => count > 1)).toEqual([]);
  });
});

describe("detect", () => {
  test("real recipe", () => {
    expect(detect("Roggenmehl")).toEqual({ allergens: ["gluten"], unknown: [] });
    expect(detect("Weizenmehl")).toEqual({ allergens: ["gluten"], unknown: [] });
    expect(detect("Weizenerzeugnisse")).toEqual({ allergens: ["gluten"], unknown: [] });
    expect(detect("Malze")).toEqual({ allergens: ["gluten"], unknown: [] });
    expect(detect("Glukose-Fructose-Sirup")).toEqual({ allergens: [], unknown: [] });
    expect(detect("Salz")).toEqual({ allergens: [], unknown: [] });
    expect(detect("Wasser")).toEqual({ allergens: [], unknown: [] });
  });

  test("typos are unknown, never guessed", () => {
    expect(detect("Roggenmmehl")).toEqual({ allergens: [], unknown: ["roggenmmehl"] });
    expect(detect("Glukose-Fructose-Sirpu")).toEqual({ allergens: [], unknown: ["sirpu"] });
  });

  test.each([
    ["Milchsäure", []],
    ["Kokosmilch", []],
    ["Kakaobutter", []],
    ["Muskatnuss", []],
    ["Erdmandel", []],
    ["Erdnussbutter", ["peanuts"]],
    ["Mandelmilch", ["nuts"]],
    ["Tintenfisch", ["molluscs"]],
    ["Weizeneiweiß", ["gluten"]],
    ["Lupineneiweiß", ["lupin"]],
    ["Maisgrieß", []],
    ["Grieß", ["gluten"]],
    ["Buttermilch", ["milk"]],
    ["Sojalecithin", ["soybeans"]],
  ])("trap %s", (name, allergens) => {
    expect(detect(name)).toEqual({ allergens, unknown: [] });
  });

  test("Buchweizen is not wheat", () => {
    expect(detect("Buchweizen").allergens).toEqual([]);
  });

  test("allergens come in Annex II order", () => {
    expect(detect("Senf Sesam Milch Weizen")).toEqual({
      allergens: ["gluten", "milk", "mustard", "sesame"],
      unknown: [],
    });
  });

  test("case, ß and whitespace do not matter", () => {
    expect(detect("  WEIZENEIWEISS ")).toEqual(detect("Weizeneiweiß"));
    expect(detect("Weizenmehl Type 550")).toEqual({ allergens: ["gluten"], unknown: [] });
  });
});

describe("properties", () => {
  const terms = ALLERGEN_IDS.flatMap((id) =>
    de.allergens[id].terms.map((term) => [id, term] as const),
  );

  test("an unknown prefix never yields a match (Buchweizen class)", () => {
    const prefix = fc.string({ minLength: 1, unit: fc.constantFrom("q", "x", "j") });
    fc.assert(
      fc.property(prefix, fc.constantFrom(...terms), (p, [, term]) => {
        const result = detect(p + term);
        expect(result.allergens).toEqual([]);
        expect(result.unknown).toHaveLength(1);
      }),
    );
  });

  test("an allergen term followed by a neutral piece keeps its allergen", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...terms),
        fc.constantFrom("mehl", "pulver", "extrakt"),
        ([id, term], tail) => {
          expect(detect(term + tail).allergens).toContain(id);
        },
      ),
    );
  });
});
