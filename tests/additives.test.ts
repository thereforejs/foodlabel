import { toDecimalString } from "@thereforejs/decy";
import { describe, expect, test } from "vite-plus/test";
import de from "../src/additives/de.json" with { type: "json" };
import { ADDITIVE_CLASS_IDS } from "../src/additives/classes.ts";
import { normalizeTerm } from "../src/core/allergens.ts";
import { toENumber } from "../src/core/additives.ts";
import { createIngredientsList } from "../src/core/ingredients.ts";
import type { Ingredient, ResolvedIngredient } from "../src/types/index.ts";

type Row = [string, string, string?, Row[]?];
const rows = (items: ResolvedIngredient[]): Row[] =>
  items.map((item) => {
    const row: Row = [item.name, toDecimalString(item.weight)];
    if (item.eNumber) row[2] = item.eNumber;
    if (item.children) row[3] = rows(item.children);
    return row;
  });

const additive = (
  name: string,
  quantity: number,
  eNumberCategory: string,
  eNumber?: string,
): Ingredient => ({ name, quantity, unit: "weight", eNumberCategory, eNumber });

describe("vocabulary de", () => {
  test("every class has a singular and a plural", () => {
    for (const id of ADDITIVE_CLASS_IDS) {
      expect(de.classes[id].singular).not.toBe("");
      expect(de.classes[id].plural).not.toBe("");
    }
  });

  test("every name points to exactly one E number", () => {
    const names = Object.values(de.additives).flatMap((entry) => [entry.name, ...entry.synonyms]);
    const normalized = names.map(normalizeTerm);
    expect(normalized.filter((name, index) => normalized.indexOf(name) !== index)).toEqual([]);
  });

  test("E numbers are written as in Annex II", () => {
    for (const eNumber of Object.keys(de.additives))
      expect(eNumber).toMatch(/^E \d{3,4}[a-z]?(\([ivx]+\))?$/);
  });
});

describe("additives", () => {
  test("same class is one entry, placed by its total weight", () => {
    const result = createIngredientsList([
      { name: "Weizenmehl", quantity: 1000, unit: "weight" },
      { name: "Salz", quantity: 20, unit: "weight" },
      additive("Mono- und Diglyceride von Speisefettsäuren", 15, "Emulgator", "E 471"),
      additive("Sojalecithin", 10, "Emulgator"),
    ]);
    expect(rows(result)).toEqual([
      ["Weizenmehl", "1000"],
      [
        "Emulgatoren",
        "25",
        undefined,
        [
          ["Mono- und Diglyceride von Speisefettsäuren", "15", "E 471"],
          ["Sojalecithin", "10", "E 322"],
        ],
      ],
      ["Salz", "20"],
    ]);
    expect(result[1]?.allergens).toEqual(["soybeans"]);
  });

  test("a single member gets the singular", () => {
    const [, group] = createIngredientsList([
      { name: "Weizenmehl", quantity: 1000, unit: "weight" },
      additive("Ascorbinsäure", 1, "Mehlbehandlungsmittel"),
    ]);
    expect(group?.name).toBe("Mehlbehandlungsmittel");
    expect(group?.additiveClass).toBe("flourTreatmentAgent");
  });

  test("one substance in two classes is listed twice and never added up", () => {
    const result = createIngredientsList([
      { name: "Weizenmehl", quantity: 1000, unit: "weight" },
      additive("Calciumphosphate", 5, "Backtriebmittel", "E 341"),
      additive("Calciumphosphate", 3, "Säureregulator", "E 341"),
    ]);
    expect(rows(result)).toEqual([
      ["Weizenmehl", "1000"],
      ["Backtriebmittel", "5", undefined, [["Calciumphosphate", "5", "E 341"]]],
      ["Säureregulator", "3", undefined, [["Calciumphosphate", "3", "E 341"]]],
    ]);
  });

  test("same substance and class from different raw materials is merged", () => {
    const result = createIngredientsList([
      { name: "Weizenmehl", quantity: 1000, unit: "weight" },
      {
        name: "Backmittel",
        quantity: 100,
        unit: "weight",
        children: [
          { name: "Weizenmehl", quantity: 90, unit: "weight" },
          additive("Ascorbinsäure", 10, "Mehlbehandlungsmittel", "e300"),
        ],
      },
      additive("Ascorbinsäure", 5, "Mehlbehandlungsmittel"),
    ]);
    expect(rows(result)).toEqual([
      ["Weizenmehl", "1090"],
      ["Mehlbehandlungsmittel", "15", undefined, [["Ascorbinsäure", "15", "E 300"]]],
    ]);
  });

  test("classes are formed inside a group, not across it", () => {
    const result = createIngredientsList([
      { name: "Weizenmehl", quantity: 1000, unit: "weight" },
      {
        name: "Backmittel",
        quantity: 100,
        unit: "weight",
        group: true,
        children: [
          { name: "Weizenmehl", quantity: 90, unit: "weight" },
          additive("Ascorbinsäure", 10, "Mehlbehandlungsmittel"),
        ],
      },
      additive("Ascorbinsäure", 5, "Mehlbehandlungsmittel"),
    ]);
    expect(rows(result)).toEqual([
      ["Weizenmehl", "1000"],
      [
        "Backmittel",
        "100",
        undefined,
        [
          ["Weizenmehl", "90"],
          ["Mehlbehandlungsmittel", "10", undefined, [["Ascorbinsäure", "10", "E 300"]]],
        ],
      ],
      ["Mehlbehandlungsmittel", "5", undefined, [["Ascorbinsäure", "5", "E 300"]]],
    ]);
  });

  test("an unknown class is refused with its path", () => {
    expect(() => createIngredientsList([additive("Ascorbinsäure", 1, "Vitamin")])).toThrow("[0]");
  });

  test("an unknown E number is refused", () => {
    expect(() => createIngredientsList([additive("Irgendwas", 1, "Emulgator", "E 1234")])).toThrow(
      "[0]",
    );
  });

  test("a name that is no known additive is refused, never guessed", () => {
    expect(() =>
      createIngredientsList([additive("Ascorbinsaeure", 1, "Antioxidationsmittel")]),
    ).toThrow("[0]");
  });
});

describe("authorisation", () => {
  test.each([
    ["by number", additive("Titandioxid", 1, "Farbstoff", "E 171")],
    ["by name", additive("Titandioxid", 1, "Farbstoff")],
  ])("an additive listed but authorised in no food is refused %s", (_, ingredient) => {
    expect(() => createIngredientsList([ingredient])).toThrow(
      expect.objectContaining({
        diagnostics: [
          expect.objectContaining({
            code: "additive.notAuthorized",
            path: "[0]",
            params: { name: "Titandioxid", eNumber: "E 171" },
          }),
        ],
      }),
    );
  });
});

describe("toENumber", () => {
  test.each([
    ["e300", "E 300"],
    ["E 472e", "E 472e"],
    ["e160b(i)", "E 160b(i)"],
    ["E 160b (ii)", "E 160b(ii)"],
  ])("%s -> %s", (text, eNumber) => {
    expect(toENumber(text)).toBe(eNumber);
  });

  test("a sub-numbered additive is found by its number", () => {
    const [entry] = createIngredientsList([additive("Annatto", 1, "Farbstoff", "e160b(i)")]);
    expect(entry?.children?.[0]?.eNumber).toBe("E 160b(i)");
  });
});
